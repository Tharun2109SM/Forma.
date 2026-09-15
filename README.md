# Forma.

Forma. is an explainable candidate-intelligence product with Supabase email/password auth, direct-to-R2 multi-format intake, format-aware native extraction with OpenAI OCR fallback for scanned PDFs, pgvector indexing, analysis-scoped recruiter Q&A, and a strict deterministic-ranking boundary.

The language model never assigns the final rank. Ranking combines semantic relevance, explicit keyword matches, and required-skill coverage with deterministic weights. RAG answers questions only from retrieved upload evidence and existing structured scores.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without credentials the application intentionally opens a labeled sample workspace. Document selections in preview mode are validated but not persisted.

## Product structure

The public site lives at `/`, `/product`, `/method`, `/security`, and `/pricing`. The authenticated product uses a separate SaaS shell under `/app`, with analysis, candidate, document, and settings libraries. Legacy `/dashboard` and `/analysis/*` links redirect to their canonical `/app/*` equivalents without dropping query parameters.

The app shell supports a full desktop rail, a compact tablet rail, a mobile navigation sheet, light and dark themes, and a Cmd/Ctrl+K command menu. List search, filters, sorting, and pagination are URL-backed so views remain linkable and server-rendered.

## Configuration

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional `R2_ENDPOINT`
- `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EXPLANATION_MODEL`, `OPENAI_RAG_MODEL`
- `OCR_PROVIDER=openai`
- `MAX_RESUMES_PER_ANALYSIS`, `NEXT_PUBLIC_MAX_RESUMES_PER_ANALYSIS`, `NEXT_PUBLIC_UPLOAD_CONCURRENCY`

Private credentials are used only by server-only modules. Raw documents go to Cloudflare R2; Postgres stores keys, metadata, extracted text, chunks, embeddings, and computed results.

## R2 direct upload and CORS

Production intake uses 10-minute presigned `PUT` URLs bound to each document MIME type, so file bodies travel directly from the browser to R2 and never through a Vercel Function. PDF, DOCX, XML, and TXT are accepted. Object keys are server-generated under `users/{userId}/analyses/{analysisId}/jd|resumes/{documentId}.{ext}`, so duplicate filenames cannot collide. Uploads run with bounded concurrency (default four), retry transient errors three times, and track each file independently.

For bucket `forma-documents`, use this exact browser-upload policy. Do not keep wildcard origins in production:

```json
[
  {
    "AllowedOrigins": [
      "https://forma-one-ebon.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Supabase confirmation supports both PKCE `code` callbacks and token-hash links. Set the hosted project URL/redirect allow list to `NEXT_PUBLIC_SITE_URL/auth/confirm`; if using a custom email template, send `token_hash` and `type=signup` to that route.

## Document processing and RAG

Each document has an independent state: `UPLOADING`, `UPLOADED`, `EXTRACTING`, `OCR`, `NORMALIZING`, `INDEXING`, `READY`, or `FAILED`. The processing page reads these real states, resumes uploaded documents after refresh, reclaims stale work after five minutes, and lets the recruiter retry isolated failures.

PDF extraction uses the serverless PDF.js build from `unpdf`. A deterministic quality gate triggers OpenAI vision only for PDF parser errors, image-only/scanned pages, implausibly short output, or unreadable text. DOCX paragraphs and tables are extracted without executing macros or embedded content; XML rejects DTD/entity declarations before parsing; TXT uses forgiving UTF-8 decoding. R2 remains the only persistent object store. Any extraction/OCR failure marks only that document failed, and empty text is never ranked or indexed.

Normalized documents are chunked at approximately 700 tokens with roughly 100 tokens of overlap. Every chunk retains user, analysis, document, candidate, filename, file extension, page when available, index, and section provenance. OpenAI `text-embedding-3` models are requested with 1,536 dimensions, matching the database type, and chunks are idempotently upserted on `(document_id, chunk_index)`.

`POST /api/analysis/{analysisId}/ask` authenticates the recruiter, verifies analysis ownership, embeds the question, calls `match_document_chunks`, diversifies evidence across documents, attaches existing deterministic ranking metadata, and requests an evidence-only answer. The response includes source filename, candidate, page, chunk, excerpt, and similarity. The model does not assign or change ranks.

Completed results expose this endpoint through the **Ask Forma.** analysis tab. It is enabled only when owner-visible indexed chunks exist, keeps its conversation in page state, supports Enter/Shift+Enter, and renders every returned source as expandable provenance with document type, filename, page/section when present, excerpt, and retrieval relevance. No chat content is persisted.

## Database and checks

The initial schema lives in `supabase/migrations/20260912060724_initial_candidate_intelligence_schema.sql`. The ingestion/RAG migration in `supabase/migrations/20260912070616_document_ingestion_and_rag.sql` enables pgvector, creates `documents` and `document_chunks`, adds a cosine HNSW index, and exposes the security-invoker `match_document_chunks` RPC to authenticated owners only. `20260912081742_multi_format_document_support.sql` makes metadata, constraints, and private R2 namespaces format-neutral for PDF, DOCX, XML, and TXT.

```bash
npm run fixtures:generate
npm test
npm run typecheck
npm run lint
npm run build
npx supabase db lint --local --level warning --fail-on error
npx supabase test db
npx supabase db advisors --local
npx supabase db query --linked --file supabase/verification/hosted_verification.sql
npx supabase db advisors --linked --type all --level warn --fail-on none
```

The project-scoped `.mcp.json` and Supabase CLI link target hosted project `vjvlblpskkisczskpekv`. No access token or secret is stored in the repository.
