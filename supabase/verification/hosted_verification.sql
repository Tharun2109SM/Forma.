select jsonb_build_object(
  'project_database', current_database(),
  'server_version', current_setting('server_version'),
  'migrations', (
    select jsonb_agg(version order by version)
    from supabase_migrations.schema_migrations
    where version in ('20260912060724', '20260912070616', '20260912081742')
  ),
  'tables', (
    select jsonb_object_agg(c.relname, c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('profiles', 'analyses', 'candidates', 'documents', 'document_chunks')
      and c.relkind = 'r'
  ),
  'vector_extension', (
    select jsonb_build_object('version', extversion, 'schema', n.nspname)
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where extname = 'vector'
  ),
  'embedding_type', (
    select format_type(a.atttypid, a.atttypmod)
    from pg_attribute a
    where a.attrelid = 'public.document_chunks'::regclass
      and a.attname = 'embedding'
      and not a.attisdropped
  ),
  'hnsw_cosine_index', (
    select indexdef
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'document_chunks_embedding_hnsw_index'
  ),
  'rpc', (
    select jsonb_build_object(
      'security_definer', prosecdef,
      'volatility', provolatile,
      'authenticated_execute', has_function_privilege(
        'authenticated', oid, 'execute'
      ),
      'anon_execute', has_function_privilege('anon', oid, 'execute')
    )
    from pg_proc
    where oid = 'public.match_document_chunks(uuid,extensions.vector,integer,double precision)'::regprocedure
  ),
  'policies', (
    select jsonb_agg(
      jsonb_build_object('table', tablename, 'name', policyname, 'roles', roles)
      order by tablename, policyname
    )
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'analyses', 'candidates', 'documents', 'document_chunks')
  ),
  'authenticated_grants', (
    select jsonb_agg(
      jsonb_build_object('table', table_name, 'privilege', privilege_type)
      order by table_name, privilege_type
    )
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name in ('profiles', 'analyses', 'candidates', 'documents', 'document_chunks')
  ),
  'ownership_triggers', (
    select jsonb_agg(tgname order by tgname)
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'analyses_prevent_owner_change',
        'candidates_validate_parent_and_key',
        'documents_validate_parent_and_key',
        'document_chunks_validate_parent'
      )
  ),
  'document_columns', (
    select jsonb_object_agg(column_name, is_nullable order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name in (
        'filename', 'mime_type', 'file_extension', 'object_key', 'document_type',
        'status', 'extraction_method', 'extracted_text', 'char_count', 'page_count',
        'ocr_used', 'ocr_provider', 'error', 'created_at', 'updated_at'
      )
  ),
  'test_fixture_rows', (
    select count(*)
    from public.profiles
    where email like '%@forma.test'
  )
) as hosted_verification;
