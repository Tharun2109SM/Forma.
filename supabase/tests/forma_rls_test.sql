begin;

select plan(31);

select ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select ok(to_regclass('public.analyses') is not null, 'analyses table exists');
select ok(to_regclass('public.candidates') is not null, 'candidates table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.analyses'::regclass),
  'analyses has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.candidates'::regclass),
  'candidates has RLS enabled'
);

select is(
  (
    select array_agg(policyname order by policyname)::text
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  ),
  '{profiles_select_own,profiles_update_own}',
  'profiles exposes only own-row select and update policies'
);
select is(
  (
    select array_agg(policyname order by policyname)::text
    from pg_policies
    where schemaname = 'public' and tablename = 'analyses'
  ),
  '{analyses_select_own}',
  'analyses exposes only the own-row select policy'
);
select is(
  (
    select array_agg(policyname order by policyname)::text
    from pg_policies
    where schemaname = 'public' and tablename = 'candidates'
  ),
  '{candidates_select_via_analysis_owner}',
  'candidates exposes only the analysis-owner select policy'
);
select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidates'
      and policyname = 'candidates_select_via_analysis_owner'
      and qual ilike '%analyses%'
      and qual ilike '%auth.uid%'
  ),
  'candidate access follows the analysis ownership chain'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select')
  and not has_table_privilege('anon', 'public.analyses', 'select')
  and not has_table_privilege('anon', 'public.candidates', 'select'),
  'anon has no table read access'
);
select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select')
  and has_table_privilege('authenticated', 'public.analyses', 'select')
  and has_table_privilege('authenticated', 'public.candidates', 'select'),
  'authenticated can select through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.analyses', 'insert')
  and not has_table_privilege('authenticated', 'public.analyses', 'update')
  and not has_table_privilege('authenticated', 'public.analyses', 'delete'),
  'authenticated cannot mutate analyses directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.candidates', 'insert')
  and not has_table_privilege('authenticated', 'public.candidates', 'update')
  and not has_table_privilege('authenticated', 'public.candidates', 'delete'),
  'authenticated cannot mutate candidate results directly'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'update'),
  'authenticated can update only the display name column'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'email', 'update'),
  'authenticated cannot update the synchronized email column'
);
select ok(
  has_table_privilege('service_role', 'public.profiles', 'select')
  and has_table_privilege('service_role', 'public.profiles', 'insert')
  and has_table_privilege('service_role', 'public.profiles', 'update')
  and has_table_privilege('service_role', 'public.profiles', 'delete')
  and has_table_privilege('service_role', 'public.analyses', 'select')
  and has_table_privilege('service_role', 'public.analyses', 'insert')
  and has_table_privilege('service_role', 'public.analyses', 'update')
  and has_table_privilege('service_role', 'public.analyses', 'delete')
  and has_table_privilege('service_role', 'public.candidates', 'select')
  and has_table_privilege('service_role', 'public.candidates', 'insert')
  and has_table_privilege('service_role', 'public.candidates', 'update')
  and has_table_privilege('service_role', 'public.candidates', 'delete'),
  'service role has the server-side CRUD privileges it needs'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'candidates_analysis_id_fkey'
      and conrelid = 'public.candidates'::regclass
      and confrelid = 'public.analyses'::regclass
      and confdeltype = 'c'
  ),
  'candidate records cascade-delete with their analysis'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'analyses_user_id_fkey'
      and conrelid = 'public.analyses'::regclass
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ),
  'analyses cascade-delete with their auth user'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'analyses'
      and indexname = 'analyses_user_created_at_index'
  ),
  'analysis ownership and history ordering are indexed together'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'candidates_analysis_rank_unique'
      and conrelid = 'public.candidates'::regclass
      and contype = 'u'
      and condeferrable
  ),
  'candidate rank uniqueness is deferrable for transactional reranking'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.candidates'::regclass
      and tgname = 'candidates_maintain_count'
      and not tgisinternal
      and tgenabled <> 'D'
  ),
  'candidate count maintenance trigger is active'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'analyses_jd_object_key_check'
      and conrelid = 'public.analyses'::regclass
  ),
  'job-description object keys are namespace constrained'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.candidates'::regclass
      and tgname = 'candidates_validate_parent_and_key'
      and not tgisinternal
      and tgenabled <> 'D'
  ),
  'resume object keys are validated against their analysis owner'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated cannot access the private helper schema'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.sync_profile_from_auth()',
    'execute'
  ),
  'authenticated cannot invoke the profile synchronization trigger directly'
);

-- Exercise tenant isolation with two real auth identities, not just catalogs.
insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'one@forma.test'),
  ('20000000-0000-0000-0000-000000000002', 'two@forma.test');

insert into public.analyses (id, user_id, title, jd_filename)
values
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Recruiter one analysis',
    'role-one.pdf'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Recruiter two analysis',
    'role-two.pdf'
  );

insert into public.candidates (analysis_id, resume_filename)
values
  ('11000000-0000-0000-0000-000000000001', 'candidate-one.pdf'),
  ('22000000-0000-0000-0000-000000000002', 'candidate-two.pdf');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.profiles), 1::bigint, 'recruiter sees only their profile');
select is((select count(*) from public.analyses), 1::bigint, 'recruiter sees only their analysis');
select is((select count(*) from public.candidates), 1::bigint, 'recruiter sees only candidates owned through their analysis');
select is(
  (select title from public.analyses),
  'Recruiter one analysis',
  'the visible analysis belongs to the active recruiter'
);
select is(
  (select resume_filename from public.candidates),
  'candidate-one.pdf',
  'the visible candidate follows the active recruiter ownership chain'
);

select * from finish();
rollback;
