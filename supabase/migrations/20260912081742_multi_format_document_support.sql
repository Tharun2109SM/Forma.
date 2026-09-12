begin;

alter table public.analyses
  drop constraint if exists analyses_jd_filename_check,
  drop constraint if exists analyses_jd_object_key_check;

alter table public.analyses
  add constraint analyses_jd_filename_check check (
    jd_filename is null or (
      char_length(btrim(jd_filename)) between 5 and 255
      and lower(jd_filename) ~ '\.(pdf|docx|xml|txt)$'
    )
  ),
  add constraint analyses_jd_object_key_check check (
    jd_object_key is null or (
      char_length(jd_object_key) <= 1024
      and jd_object_key ~ (
        '^users/' || user_id::text || '/analyses/' || id::text ||
        '/jd/[0-9a-f-]{36}\.(pdf|docx|xml|txt)$'
      )
    )
  );

alter table public.candidates
  drop constraint if exists candidates_resume_filename_check;

alter table public.candidates
  add constraint candidates_resume_filename_check check (
    char_length(btrim(resume_filename)) between 5 and 255
    and lower(resume_filename) ~ '\.(pdf|docx|xml|txt)$'
  );

alter table public.documents
  add column file_extension text;

update public.documents
set file_extension = lower(substring(filename from '\.([^.]+)$'));

alter table public.documents
  alter column file_extension set not null;

alter table public.documents
  rename column extracted_character_count to char_count;

alter table public.documents
  rename column error_message to error;

alter table public.documents
  drop constraint if exists documents_filename_check,
  drop constraint if exists documents_mime_type_check;

alter table public.documents
  add constraint documents_filename_check check (
    char_length(btrim(filename)) between 5 and 255
    and lower(filename) ~ '\.(pdf|docx|xml|txt)$'
    and lower(substring(filename from '\.([^.]+)$')) = file_extension
  ),
  add constraint documents_file_extension_check check (
    file_extension in ('pdf', 'docx', 'xml', 'txt')
  ),
  add constraint documents_mime_type_check check (
    (file_extension = 'pdf' and mime_type = 'application/pdf')
    or (
      file_extension = 'docx'
      and mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    or (file_extension = 'xml' and mime_type in ('application/xml', 'text/xml'))
    or (file_extension = 'txt' and mime_type = 'text/plain')
  );

create or replace function private.validate_candidate_parent_and_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
  expected_key text;
  file_extension text;
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

  file_extension := lower(substring(new.resume_filename from '\.([^.]+)$'));
  expected_key :=
    'users/' || owner_id::text || '/analyses/' || new.analysis_id::text ||
    '/resumes/' || new.id::text || '.' || file_extension;

  if new.resume_object_key <> expected_key then
    raise exception 'resume object key is outside the candidate namespace'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_document_parent_and_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
  candidate_analysis_id uuid;
  candidate_filename text;
  candidate_object_key text;
  expected_key text;
begin
  if tg_op = 'UPDATE' and (
    new.analysis_id is distinct from old.analysis_id
    or new.candidate_id is distinct from old.candidate_id
    or new.user_id is distinct from old.user_id
    or new.document_type is distinct from old.document_type
    or new.object_key is distinct from old.object_key
    or new.file_extension is distinct from old.file_extension
  ) then
    raise exception 'document ownership, namespace, and format cannot be changed'
      using errcode = '23514';
  end if;

  select analysis.user_id into owner_id
  from public.analyses as analysis
  where analysis.id = new.analysis_id;

  if not found or owner_id <> new.user_id then
    raise exception 'document owner does not own the analysis'
      using errcode = '23514';
  end if;

  if new.document_type = 'RESUME' then
    select candidate.analysis_id, candidate.resume_filename, candidate.resume_object_key
      into candidate_analysis_id, candidate_filename, candidate_object_key
    from public.candidates as candidate
    where candidate.id = new.candidate_id;

    if not found or candidate_analysis_id <> new.analysis_id then
      raise exception 'resume candidate belongs to another analysis'
        using errcode = '23514';
    end if;
  end if;

  expected_key :=
    'users/' || new.user_id::text || '/analyses/' || new.analysis_id::text ||
    case when new.document_type = 'JOB_DESCRIPTION' then '/jd/' else '/resumes/' end ||
    new.id::text || '.' || new.file_extension;

  if new.object_key <> expected_key then
    raise exception 'document object key is outside its owner namespace'
      using errcode = '23514';
  end if;

  if new.document_type = 'RESUME' and (
    candidate_filename <> new.filename or candidate_object_key <> new.object_key
  ) then
    raise exception 'resume document does not match its candidate file'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_validate_parent_and_key on public.documents;
create trigger documents_validate_parent_and_key
before insert or update of
  analysis_id, candidate_id, user_id, document_type, object_key, file_extension
on public.documents
for each row execute function private.validate_document_parent_and_key();

comment on column public.documents.file_extension is
  'Lowercase original document extension: pdf, docx, xml, or txt.';
comment on column public.documents.char_count is
  'Character count of normalized extracted text.';
comment on column public.documents.error is
  'Safe per-document upload or processing error; null after success.';

commit;
