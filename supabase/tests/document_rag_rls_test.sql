begin;

select plan(24);

select ok(to_regclass('public.documents') is not null, 'documents table exists');
select ok(to_regclass('public.document_chunks') is not null, 'document_chunks table exists');
select ok(
  exists (select 1 from pg_extension where extname = 'vector'),
  'pgvector extension is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.documents'::regclass),
  'documents has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.document_chunks'::regclass),
  'document_chunks has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.documents', 'select')
  and not has_table_privilege('anon', 'public.document_chunks', 'select'),
  'anon cannot read documents or chunks'
);
select ok(
  has_table_privilege('authenticated', 'public.documents', 'select')
  and has_table_privilege('authenticated', 'public.document_chunks', 'select')
  and not has_table_privilege('authenticated', 'public.documents', 'insert')
  and not has_table_privilege('authenticated', 'public.document_chunks', 'insert'),
  'authenticated users have read-only table grants behind RLS'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.match_document_chunks(uuid,extensions.vector,integer,double precision)',
    'execute'
  ),
  'authenticated users may invoke scoped similarity search'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.match_document_chunks(uuid,extensions.vector,integer,double precision)',
    'execute'
  ),
  'anonymous callers cannot invoke similarity search'
);
select is(
  (
    select prosecdef
    from pg_proc
    where oid = 'public.match_document_chunks(uuid,extensions.vector,integer,double precision)'::regprocedure
  ),
  false,
  'similarity search runs as security invoker'
);
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'document_chunks'
      and indexname = 'document_chunks_embedding_hnsw_index'
      and indexdef ilike '%using hnsw%vector_cosine_ops%'
  ),
  'document embeddings use an HNSW cosine index'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'document_chunks_document_index_unique'
      and conrelid = 'public.document_chunks'::regclass
  ),
  'chunk retries cannot duplicate a document chunk index'
);

insert into auth.users (id, email)
values
  ('30000000-0000-0000-0000-000000000003', 'rag-one@forma.test'),
  ('40000000-0000-0000-0000-000000000004', 'rag-two@forma.test');

insert into public.analyses (id, user_id, title)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Owner one A'),
  ('32000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Owner one B'),
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'Owner two A');

insert into public.candidates (id, analysis_id, resume_filename)
values
  ('31100000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'one-a.pdf'),
  ('32100000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', 'one-b.pdf'),
  ('41100000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'two-a.pdf');

insert into public.documents (
  id, analysis_id, candidate_id, user_id, document_type,
  filename, object_key, file_size, status
)
values
  (
    '31100000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    '31100000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    'RESUME', 'one-a.pdf',
    'users/30000000-0000-0000-0000-000000000003/analyses/31000000-0000-0000-0000-000000000001/resumes/31100000-0000-0000-0000-000000000001.pdf',
    1000, 'READY'
  ),
  (
    '32100000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000002',
    '32100000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    'RESUME', 'one-b.pdf',
    'users/30000000-0000-0000-0000-000000000003/analyses/32000000-0000-0000-0000-000000000002/resumes/32100000-0000-0000-0000-000000000002.pdf',
    1000, 'READY'
  ),
  (
    '41100000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    '41100000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000004',
    'RESUME', 'two-a.pdf',
    'users/40000000-0000-0000-0000-000000000004/analyses/41000000-0000-0000-0000-000000000001/resumes/41100000-0000-0000-0000-000000000001.pdf',
    1000, 'READY'
  );

insert into public.document_chunks (
  analysis_id, document_id, candidate_id, user_id, document_type,
  chunk_index, page_number, content, embedding, metadata
)
select
  document.analysis_id,
  document.id,
  document.candidate_id,
  document.user_id,
  document.document_type,
  0,
  1,
  'Node.js PostgreSQL REST API evidence for ' || document.filename,
  ('[1,' || array_to_string(array_fill(0, array[1535]), ',') || ']')::extensions.vector(1536),
  jsonb_build_object('filename', document.filename)
from public.documents as document;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.documents), 2::bigint, 'owner sees only their documents');
select is((select count(*) from public.document_chunks), 2::bigint, 'owner sees only their chunks');
select is(
  (select count(*) from public.documents where analysis_id = '31000000-0000-0000-0000-000000000001'),
  1::bigint,
  'analysis filtering returns only the selected analysis document'
);
select is(
  (
    select count(*)
    from public.match_document_chunks(
      '31000000-0000-0000-0000-000000000001',
      ('[1,' || array_to_string(array_fill(0, array[1535]), ',') || ']')::extensions.vector(1536),
      10,
      0.1
    )
  ),
  1::bigint,
  'retrieval is restricted to the selected analysis'
);
select is(
  (
    select count(*)
    from public.match_document_chunks(
      '41000000-0000-0000-0000-000000000001',
      ('[1,' || array_to_string(array_fill(0, array[1535]), ',') || ']')::extensions.vector(1536),
      10,
      0.1
    )
  ),
  0::bigint,
  'retrieval cannot cross recruiter ownership'
);
select is(
  (
    select filename
    from public.match_document_chunks(
      '31000000-0000-0000-0000-000000000001',
      ('[1,' || array_to_string(array_fill(0, array[1535]), ',') || ']')::extensions.vector(1536),
      10,
      0.1
    )
  ),
  'one-a.pdf',
  'retrieval retains source filename provenance'
);
select is(
  (
    select candidate_id
    from public.match_document_chunks(
      '31000000-0000-0000-0000-000000000001',
      ('[1,' || array_to_string(array_fill(0, array[1535]), ',') || ']')::extensions.vector(1536),
      10,
      0.1
    )
  ),
  '31100000-0000-0000-0000-000000000001'::uuid,
  'retrieval retains candidate identity provenance'
);

reset role;
select throws_ok(
  $$
    insert into public.documents (
      id, analysis_id, candidate_id, user_id, document_type,
      filename, object_key, file_size
    ) values (
      '39900000-0000-0000-0000-000000000009',
      '31000000-0000-0000-0000-000000000001',
      '31100000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000003',
      'RESUME', 'invalid.pdf', 'users/another/path.pdf', 1000
    )
  $$,
  '23514',
  null,
  'document trigger rejects an arbitrary R2 object key'
);
select throws_ok(
  $$
    insert into public.document_chunks (
      analysis_id, document_id, candidate_id, user_id, document_type,
      chunk_index, content, embedding
    )
    select
      analysis_id, id, candidate_id, user_id, document_type,
      0, 'duplicate',
      ('[1,' || array_to_string(array_fill(0, array[1535]), ',') || ']')::extensions.vector(1536)
    from public.documents
    where id = '31100000-0000-0000-0000-000000000001'
  $$,
  '23505',
  null,
  'duplicate chunk indexes are rejected'
);
select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('documents', 'document_chunks')
  ),
  2::bigint,
  'document tables expose only their owner select policies'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.documents'::regclass
      and tgname = 'documents_validate_parent_and_key'
      and not tgisinternal
  ),
  'document ownership and R2 namespace trigger is active'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.document_chunks'::regclass
      and tgname = 'document_chunks_validate_parent'
      and not tgisinternal
  ),
  'chunk provenance trigger is active'
);

select * from finish();
rollback;
