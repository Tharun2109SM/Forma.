begin;

create extension if not exists vector with schema extensions;

alter table public.analyses
  drop constraint if exists analyses_jd_object_key_check;

alter table public.analyses
  add constraint analyses_jd_object_key_check check (
    jd_object_key is null or (
      char_length(jd_object_key) <= 1024
      and jd_object_key like
        'users/' || user_id::text || '/analyses/' || id::text || '/jd/%.pdf'
    )
  );

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  filename text not null,
  object_key text not null,
  mime_type text not null default 'application/pdf',
  file_size bigint not null,
  status text not null default 'QUEUED',
  extraction_method text,
  extracted_text text,
  page_count integer,
  ocr_used boolean not null default false,
  ocr_provider text,
  extracted_character_count integer,
  error_message text,
  processing_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint documents_type_check check (
    document_type in ('JOB_DESCRIPTION', 'RESUME')
  ),
  constraint documents_candidate_type_check check (
    (document_type = 'JOB_DESCRIPTION' and candidate_id is null)
    or (document_type = 'RESUME' and candidate_id is not null)
  ),
  constraint documents_filename_check check (
    char_length(btrim(filename)) between 5 and 255
    and lower(right(filename, 4)) = '.pdf'
  ),
  constraint documents_object_key_length_check check (
    char_length(object_key) between 1 and 1024
  ),
  constraint documents_mime_type_check check (mime_type = 'application/pdf'),
  constraint documents_file_size_check check (file_size between 1 and 15728640),
  constraint documents_status_check check (
    status in (
      'QUEUED', 'UPLOADING', 'UPLOADED', 'EXTRACTING', 'OCR',
      'NORMALIZING', 'INDEXING', 'READY', 'FAILED'
    )
  ),
  constraint documents_extraction_method_check check (
    extraction_method is null or extraction_method in ('NATIVE', 'OCR')
  ),
  constraint documents_page_count_check check (page_count is null or page_count > 0),
  constraint documents_character_count_check check (
    extracted_character_count is null or extracted_character_count >= 0
  ),
  constraint documents_processing_attempts_check check (processing_attempts >= 0),
  constraint documents_candidate_unique unique (candidate_id)
);

create unique index documents_one_jd_per_analysis_index
  on public.documents (analysis_id)
  where document_type = 'JOB_DESCRIPTION';

create index documents_analysis_created_at_index
  on public.documents (analysis_id, created_at);
create index documents_candidate_id_index
  on public.documents (candidate_id)
  where candidate_id is not null;
create index documents_user_status_index
  on public.documents (user_id, status);
create index documents_analysis_status_index
  on public.documents (analysis_id, status);

create function private.validate_document_parent_and_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
  candidate_analysis_id uuid;
  expected_key text;
begin
  if tg_op = 'UPDATE' and (
    new.analysis_id is distinct from old.analysis_id
    or new.candidate_id is distinct from old.candidate_id
    or new.user_id is distinct from old.user_id
    or new.document_type is distinct from old.document_type
    or new.object_key is distinct from old.object_key
  ) then
    raise exception 'document ownership and namespace cannot be changed'
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
    select candidate.analysis_id into candidate_analysis_id
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
    new.id::text || '.pdf';

  if new.object_key <> expected_key then
    raise exception 'document object key is outside its owner namespace'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_document_parent_and_key()
  from public, anon, authenticated, service_role;

create trigger documents_validate_parent_and_key
before insert or update of analysis_id, candidate_id, user_id, document_type, object_key
on public.documents
for each row execute function private.validate_document_parent_and_key();

create trigger documents_set_updated_at
before update on public.documents
for each row execute function private.set_updated_at();

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  chunk_index integer not null,
  page_number integer,
  section_label text,
  content text not null,
  embedding extensions.vector(1536) not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint document_chunks_type_check check (
    document_type in ('JOB_DESCRIPTION', 'RESUME')
  ),
  constraint document_chunks_candidate_type_check check (
    (document_type = 'JOB_DESCRIPTION' and candidate_id is null)
    or (document_type = 'RESUME' and candidate_id is not null)
  ),
  constraint document_chunks_index_check check (chunk_index >= 0),
  constraint document_chunks_page_check check (page_number is null or page_number > 0),
  constraint document_chunks_content_check check (char_length(btrim(content)) > 0),
  constraint document_chunks_token_count_check check (
    token_count is null or token_count > 0
  ),
  constraint document_chunks_metadata_check check (jsonb_typeof(metadata) = 'object'),
  constraint document_chunks_document_index_unique unique (document_id, chunk_index)
);

create index document_chunks_analysis_index
  on public.document_chunks (analysis_id);
create index document_chunks_document_index
  on public.document_chunks (document_id, chunk_index);
create index document_chunks_candidate_index
  on public.document_chunks (candidate_id)
  where candidate_id is not null;
create index document_chunks_user_analysis_index
  on public.document_chunks (user_id, analysis_id);
create index document_chunks_embedding_hnsw_index
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create function private.validate_document_chunk_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent public.documents%rowtype;
begin
  if tg_op = 'UPDATE' and (
    new.analysis_id is distinct from old.analysis_id
    or new.document_id is distinct from old.document_id
    or new.candidate_id is distinct from old.candidate_id
    or new.user_id is distinct from old.user_id
    or new.document_type is distinct from old.document_type
  ) then
    raise exception 'chunk provenance cannot be changed' using errcode = '23514';
  end if;

  select document.* into parent
  from public.documents as document
  where document.id = new.document_id;

  if not found
    or parent.analysis_id <> new.analysis_id
    or parent.user_id <> new.user_id
    or parent.candidate_id is distinct from new.candidate_id
    or parent.document_type <> new.document_type
  then
    raise exception 'chunk provenance does not match its document'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_document_chunk_parent()
  from public, anon, authenticated, service_role;

create trigger document_chunks_validate_parent
before insert or update of analysis_id, document_id, candidate_id, user_id, document_type
on public.document_chunks
for each row execute function private.validate_document_chunk_parent();

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

revoke all on table public.documents, public.document_chunks
  from public, anon, authenticated, service_role;

grant select on table public.documents, public.document_chunks to authenticated;
grant select, insert, update, delete
  on table public.documents, public.document_chunks to service_role;

create policy documents_select_via_analysis_owner
on public.documents for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.analyses as analysis
    where analysis.id = documents.analysis_id
      and analysis.user_id = (select auth.uid())
  )
);

create policy document_chunks_select_via_analysis_owner
on public.document_chunks for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.analyses as analysis
    where analysis.id = document_chunks.analysis_id
      and analysis.user_id = (select auth.uid())
  )
);

create function public.match_document_chunks(
  p_analysis_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 12,
  p_similarity_threshold double precision default 0.2
)
returns table (
  id uuid,
  document_id uuid,
  candidate_id uuid,
  document_type text,
  filename text,
  chunk_index integer,
  page_number integer,
  section_label text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chunk.id,
    chunk.document_id,
    chunk.candidate_id,
    chunk.document_type,
    document.filename,
    chunk.chunk_index,
    chunk.page_number,
    chunk.section_label,
    chunk.content,
    chunk.metadata,
    1 - (chunk.embedding OPERATOR(extensions.<=>) p_query_embedding) as similarity
  from public.document_chunks as chunk
  join public.documents as document on document.id = chunk.document_id
  join public.analyses as analysis on analysis.id = chunk.analysis_id
  where chunk.analysis_id = p_analysis_id
    and analysis.user_id = (select auth.uid())
    and 1 - (chunk.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_similarity_threshold
  order by chunk.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(greatest(p_match_count, 1), 50);
$$;

revoke all on function public.match_document_chunks(
  uuid, extensions.vector, integer, double precision
) from public, anon;
grant execute on function public.match_document_chunks(
  uuid, extensions.vector, integer, double precision
) to authenticated, service_role;

commit;
