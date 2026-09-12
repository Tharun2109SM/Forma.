# Forma.

Forma. is an explainable candidate-intelligence product with Supabase email/password auth, direct-to-R2 multi-PDF intake, native PDF extraction with Google Cloud Vision OCR fallback, pgvector indexing, analysis-scoped recruiter Q&A, and a strict deterministic-ranking boundary.

The language model never assigns the final rank. Ranking combines semantic relevance, explicit keyword matches, and required-skill coverage with deterministic weights. RAG answers questions only from retrieved upload evidence and existing structured scores.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without credentials the application intentionally opens a labeled sample workspace. PDF selections in preview mode are validated but not persisted.

## Configuration

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional `R2_ENDPOINT`
- `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_EXPLANATION_MODEL`, `OPENAI_RAG_MODEL`
- `OCR_PROVIDER=google-vision`, `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_VISION_CREDENTIALS`
- `MAX_RESUMES_PER_ANALYSIS`, `NEXT_PUBLIC_MAX_RESUMES_PER_ANALYSIS`, `NEXT_PUBLIC_UPLOAD_CONCURRENCY`

Private credentials are used only by server-only modules. Raw PDFs go to Cloudflare R2; Postgres stores keys, metadata, extracted text, chunks, embeddings, and computed results.

## R2 direct upload and CORS

Production intake uses 10-minute presigned `PUT` URLs restricted to `application/pdf`, so file bodies travel directly from the browser to R2 and never through a Vercel Function. Object keys are server-generated under `users/{userId}/analyses/{analysisId}/jd|resumes/{documentId}.pdf`. Uploads run with bounded concurrency (default four), retry transient errors three times, and track each file independently.

Configure the bucket with concrete production and development origins. Replace the example production domain; do not keep wildcard origins in production:

```json
[
  {
    "AllowedOrigins": [
      "https://forma.example.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Supabase confirmation supports both PKCE `code` callbacks and token-hash links. Set the hosted project URL/redirect allow list to `NEXT_PUBLIC_SITE_URL/auth/confirm`; if using a custom email template, send `token_hash` and `type=signup` to that route.

## Document processing and RAG

Each PDF has an independent state: `UPLOADING`, `UPLOADED`, `EXTRACTING`, `OCR`, `NORMALIZING`, `INDEXING`, `READY`, or `FAILED`. The processing page reads these real states, resumes uploaded documents after refresh, reclaims stale work after five minutes, and lets the recruiter retry isolated processing failures.

Native extraction uses the serverless PDF.js build from `unpdf`. A deterministic quality gate triggers Google Cloud Vision only for parser errors, empty or implausibly short text, excessive replacement/non-printable characters, or poor readable-character density. Vision receives PDF bytes directly from R2 in five-page batches, so R2 remains the only persistent object store. OCR failure marks only that document failed and never creates a score from empty text.

Normalized pages are chunked at approximately 700 tokens with roughly 100 tokens of overlap. Every chunk retains user, analysis, document, candidate, filename, page, index, and section provenance. OpenAI `text-embedding-3` models are requested with 1,536 dimensions, matching the database type, and chunks are idempotently upserted on `(document_id, chunk_index)`.

`POST /api/analysis/{analysisId}/ask` authenticates the recruiter, verifies analysis ownership, embeds the question, calls `match_document_chunks`, diversifies evidence across documents, attaches existing deterministic ranking metadata, and requests an evidence-only answer. The response includes source filename, candidate, page, chunk, excerpt, and similarity. The model does not assign or change ranks.

## Database and checks

The initial schema lives in `supabase/migrations/20260912060724_initial_candidate_intelligence_schema.sql`. The ingestion/RAG migration in `supabase/migrations/20260912070616_document_ingestion_and_rag.sql` enables pgvector, creates `documents` and `document_chunks`, adds a cosine HNSW index, and exposes the security-invoker `match_document_chunks` RPC to authenticated owners only.

```bash
npm run fixtures:generate
npm test
npm run typecheck
npm run lint
npm run build
npx supabase db lint --local --level warning --fail-on error
npx supabase test db
npx supabase db advisors --local
```

The project-scoped `.mcp.json` targets hosted project `vjvlblpskkisczskpekv`. Authenticate the Supabase MCP connection and reload the Codex task before hosted migrations, auth checks, and hosted advisors can run. No access token or secret is stored in the repository.
