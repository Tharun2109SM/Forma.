begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- Supabase Data API access is opt-in: future objects stay private until granted.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_check check (
    full_name is null or char_length(btrim(full_name)) between 1 and 200
  ),
  constraint profiles_email_check check (
    email is null or char_length(btrim(email)) between 3 and 320
  )
);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled analysis',
  job_title text,
  company_name text,
  jd_object_key text,
  jd_filename text,
  jd_text text,
  candidate_count integer not null default 0,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analyses_title_check check (
    char_length(btrim(title)) between 1 and 240
  ),
  constraint analyses_job_title_check check (
    job_title is null or char_length(btrim(job_title)) between 1 and 200
  ),
  constraint analyses_company_name_check check (
    company_name is null or char_length(btrim(company_name)) between 1 and 200
  ),
  constraint analyses_jd_filename_check check (
    jd_filename is null or (
      char_length(btrim(jd_filename)) between 5 and 255
      and lower(right(jd_filename, 4)) = '.pdf'
    )
  ),
  constraint analyses_jd_object_key_check check (
    jd_object_key is null or (
      char_length(jd_object_key) <= 1024
      and jd_object_key =
        'users/' || user_id::text || '/analyses/' || id::text || '/jd/job-description.pdf'
    )
  ),
  constraint analyses_candidate_count_check check (candidate_count >= 0),
  constraint analyses_status_check check (
    status in ('DRAFT', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED')
  )
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  name text,
  email text,
  resume_object_key text,
  resume_filename text not null,
  resume_text text,
  semantic_score numeric(5, 2),
  keyword_score numeric(5, 2),
  skill_score numeric(5, 2),
  final_score numeric(5, 2),
  rank integer,
  matched_skills jsonb not null default '[]'::jsonb,
  missing_skills jsonb not null default '[]'::jsonb,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidates_name_check check (
    name is null or char_length(btrim(name)) between 1 and 200
  ),
  constraint candidates_email_check check (
    email is null or char_length(btrim(email)) between 3 and 320
  ),
  constraint candidates_resume_filename_check check (
    char_length(btrim(resume_filename)) between 5 and 255
    and lower(right(resume_filename, 4)) = '.pdf'
  ),
  constraint candidates_resume_object_key_length_check check (
    resume_object_key is null or char_length(resume_object_key) between 1 and 1024
  ),
  constraint candidates_semantic_score_check check (semantic_score between 0 and 100),
  constraint candidates_keyword_score_check check (keyword_score between 0 and 100),
  constraint candidates_skill_score_check check (skill_score between 0 and 100),
  constraint candidates_final_score_check check (final_score between 0 and 100),
  constraint candidates_rank_check check (rank > 0),
  constraint candidates_matched_skills_check check (jsonb_typeof(matched_skills) = 'array'),
  constraint candidates_missing_skills_check check (jsonb_typeof(missing_skills) = 'array'),
  constraint candidates_analysis_rank_unique
    unique (analysis_id, rank) deferrable initially immediate
);

create index analyses_user_created_at_index
  on public.analyses (user_id, created_at desc);

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger analyses_set_updated_at
before update on public.analyses
for each row execute function private.set_updated_at();

create trigger candidates_set_updated_at
before update on public.candidates
for each row execute function private.set_updated_at();

-- Profile metadata is display-only; authorization never depends on user_metadata.
create function private.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := nullif(
    btrim(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200)),
    ''
  );

  insert into public.profiles (id, full_name, email)
  values (new.id, profile_name, new.email)
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

revoke all on function private.sync_profile_from_auth() from public, anon, authenticated, service_role;

create trigger auth_user_sync_profile
after insert or update of email on auth.users
for each row execute function private.sync_profile_from_auth();

insert into public.profiles (id, full_name, email, created_at, updated_at)
select
  users.id,
  nullif(
    btrim(left(coalesce(users.raw_user_meta_data ->> 'full_name', ''), 200)),
    ''
  ),
  users.email,
  coalesce(users.created_at, now()),
  now()
from auth.users as users
on conflict (id) do update set email = excluded.email;

create function private.prevent_analysis_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'analysis owner cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_analysis_owner_change()
  from public, anon, authenticated, service_role;

create trigger analyses_prevent_owner_change
before update of user_id on public.analyses
for each row execute function private.prevent_analysis_owner_change();

create function private.validate_candidate_parent_and_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
  expected_key text;
begin
  if tg_op = 'UPDATE' and new.analysis_id is distinct from old.analysis_id then
    raise exception 'candidate analysis cannot be changed' using errcode = '23514';
  end if;

  if new.resume_object_key is null then
    return new;
  end if;

  select analysis.user_id into owner_id
  from public.analyses as analysis
  where analysis.id = new.analysis_id;

  if not found then
    raise exception 'candidate analysis is unavailable' using errcode = '23503';
  end if;

  expected_key :=
    'users/' || owner_id::text || '/analyses/' || new.analysis_id::text ||
    '/resumes/' || new.id::text || '.pdf';

  if new.resume_object_key <> expected_key then
    raise exception 'resume object key is outside the candidate namespace'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_candidate_parent_and_key()
  from public, anon, authenticated, service_role;

create trigger candidates_validate_parent_and_key
before insert or update of analysis_id, resume_object_key on public.candidates
for each row execute function private.validate_candidate_parent_and_key();

create function private.maintain_candidate_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.analyses
    set candidate_count = candidate_count + 1
    where id = new.analysis_id;
    return new;
  end if;

  update public.analyses
  set candidate_count = candidate_count - 1
  where id = old.analysis_id;
  return old;
end;
$$;

revoke all on function private.maintain_candidate_count()
  from public, anon, authenticated, service_role;

create trigger candidates_maintain_count
after insert or delete on public.candidates
for each row execute function private.maintain_candidate_count();

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;
alter table public.candidates enable row level security;

revoke all on table public.profiles, public.analyses, public.candidates
  from public, anon, authenticated, service_role;

grant usage on schema public to authenticated, service_role;
grant select on table public.profiles, public.analyses, public.candidates
  to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant select, insert, update, delete
  on table public.profiles, public.analyses, public.candidates
  to service_role;

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy analyses_select_own
on public.analyses for select
to authenticated
using (user_id = (select auth.uid()));

create policy candidates_select_via_analysis_owner
on public.candidates for select
to authenticated
using (
  exists (
    select 1
    from public.analyses as analysis
    where analysis.id = candidates.analysis_id
      and analysis.user_id = (select auth.uid())
  )
);

commit;
