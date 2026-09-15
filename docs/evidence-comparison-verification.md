# Candidate evidence and comparison — implementation report

## Status

Implemented locally. Type-check, lint, 37 tests, and the optimized Next.js production build pass. This is **not yet a live-data production sign-off**: the local browser is unauthenticated, Docker is not running, and Figma requires reauthentication. No production fixtures, synthetic answers, or database writes were introduced for verification.

## Evidence architecture

- `src/lib/evidence/service.ts` uses the request's authenticated Supabase client, with RLS active. It authenticates with `getUser`, explicitly checks `analyses.user_id`, validates each selected candidate against `analysis_id`, then batches source documents and chunks for the selected IDs.
- `src/lib/evidence/derive.ts` is a pure deterministic derivation layer. Chunk references must agree with the candidate, analysis, resume document, and document type. The document's actual filename supplies provenance; page, section, and chunk index come from persisted chunk metadata.
- Boundary-aware canonical matches precede ranking-engine aliases, then source-section relevance and chunk order. React in “reactive” and Go in “Google” are not accepted as inspectable references. Exact terms are highlighted using escaped text rendering, not injected HTML.
- Existing stored matched-skill data is authoritative for ranking. Evidence retrieval never promotes an absent requirement into a new ranking match. If the stored matcher reports a match but no inspectable direct/alias reference exists, the UI discloses that discrepancy without changing scores.
- Unindexed document extraction can supply source context. It uses the document's actual `extracted_text`, explicitly reports extracted-text origin, and leaves unavailable page/section metadata null.
- Evidence categories are derived from existing section labels; unknown sections remain OTHER. No employers, project titles, experience duration, or evidence classifications are invented.
- Semantic retrieval remains in Ask Forma. It supports context discovery; it does not create timeline matches or recalculate ranking. No additional semantic expansion of matched requirements is performed by the evidence service.
- Up to six references per requirement are ordered deterministically. Strongest-evidence summaries reuse the same references and deduplicate shared chunks.

No database migration or cached-evidence table was necessary. Existing candidate/document/analysis indexes and ownership policies remain unchanged. Resume content is not duplicated in new database storage.

## APIs and routing

- Canonical evidence API: `GET /api/analysis/[analysisId]/candidates/[candidateId]/evidence`.
- Existing plural API remains unchanged at `GET /api/analyses/[id]/candidates/[candidateId]/evidence`, preserving its `candidateId` / raw `evidence` response contract. The new timeline uses the canonical richer API.
- Evidence responses use `Cache-Control: private, no-store` and useful 400/401/404/502 errors without backend details.
- Comparison route: `/app/analyses/[id]/compare?candidates=id1,id2,id3`.
- The server accepts 2–4 distinct UUIDs, verifies that every candidate belongs to the owned analysis, and reloads persisted scores/ranks on refresh. A removed/unavailable candidate produces a recoverable comparison error with a link back to analysis.
- The comparison matrix displays persisted final, semantic, explicit (`keyword_score`), and required-coverage (`skill_score`) values. Null metrics remain unavailable, not fabricated zeros. Relative deltas are presentation-only differences between stored values.

## Connected recruiter experience

- Ranking and filtered candidate views have separate selection checkboxes. Selection state survives search, clearing search, filters, sorting, and analysis-view changes while on the page.
- A bottom comparison rail supports removal, clear-all, the one-candidate state, and a four-candidate limit. Sample/demo records cannot enter production comparison.
- Candidate details have Overview and Evidence & source navigation. Skill controls open the requirement rail, which exposes page, section, document, candidate, match type, excerpt, and expandable original extracted context.
- Matched comparison cells open the same evidence drawer. Comparison's strongest references use the same source rail.
- On mobile the matrix is replaced by a candidate switcher, active candidate metrics with other selected values, and requirement-by-requirement evidence comparisons. The evidence drawer uses the full viewport. Tablet comparison scrolls inside the matrix, with sticky candidate headers and metric labels.
- Motion/Framer powers the tray, matrix entrance, and drawer; Anime.js supplies small source-node reveals. Reduced-motion preferences are respected and animation cleanup is implemented.

## Evidence-versus-absence language

Recruiter-facing missing-skill labels, filters, marketing descriptions, candidate details, and comparison use “Not evidenced” / “No supporting evidence found,” with a professional explanatory tooltip. Internal `missingSkills` / `missing_skills` contracts are unchanged. There are no existing PDF/CSV/report export surfaces to rename.

RAG and rank-explanation instructions explicitly distinguish documented fact, absence of documented evidence, and inference. Missing resume evidence must not become a claim that the candidate lacks a skill. This is an LLM instruction guardrail, not a guarantee against every possible generated claim; live-answer review remains required.

## Comparison RAG

The existing `POST /api/analysis/[analysisId]/ask` accepts optional `candidateIds`; no separate chatbot was created. Selection is validated before embeddings or answering. Retrieval keeps JD and selected-candidate sources, supplements top-k results with owned deterministic requirement references, and retrieves actual JD chunks if top-k omitted the role document. Structured ranking supplied to the model is limited to selected candidates. The route only reads ranking records; it contains no rank/score mutation.

The comparison workspace supplies selected IDs from its server-validated route data, displays the selected names, and offers comparison-specific starter questions. Returned candidate citations open the candidate's evidence/source view; citation excerpts remain visible even when they are supporting context rather than a deterministic skill reference. Focus returns to the invoking evidence/citation button.

Deterministic citations have null similarity, not an artificial 0% relevance score. Vector retrieval citations retain the actual returned similarity.

## Security and performance verification

- Tests reject unauthenticated users, unowned analyses, unrelated candidates, malformed/duplicate selections, and five candidates.
- Tests reject cross-analysis/candidate/document provenance and preserve real filenames, pages, sections, context, and stored scores/ranks.
- Batch tests for two, three, and four candidates use one analysis, candidate, document, and chunk query each for the small fixture sets. No request/query per skill is issued. Chunk retrieval is explicitly paginated in 1,000-row batches instead of silently truncating at Supabase's default row cap.
- RAG scoping tests keep only JD + selected candidates and assert the shared no-rank-mutation / accurate-absence answer contract.
- HTTP checks against the local Next.js server: both canonical evidence and comparison Ask APIs returned 401 without a session. The browser redirected protected analysis navigation to sign-in.
- Existing hosted RLS policies were inspected; live authenticated RLS/IDOR tests were not run this session.

## Browser checks

An isolated loopback-only harness rendered the real React components using repository PDF fixtures and clearly marked test score records. It did not access/write production data or manufacture an assistant answer.

Verified in that harness:

- Select one candidate, filter to another, select the second: first selection remains in the rail.
- Open comparison URL from the rail; inspect two- and four-candidate matrices and test values.
- Click React for the alias fixture; inspect highlighted “ReactJS,” filename/page provenance, and expanded actual fixture source context.
- Open a not-evidenced requirement; inspect accurate absence language.
- Switch mobile candidates; verify the evidence sheet occupies 390 × 844.
- Check desktop at 1440 and mobile at 390; mobile document width equals viewport width.
- At 768, the four-candidate matrix is 890px inside its own scroll region, while page width remains 768px.

Still pending: signed-in real uploaded analysis → comparison → live RAG answer → citation round-trip; authenticated hosted cross-analysis attacks; final dark-theme/reduced-motion browser checks; requested Figma matrix/timeline design and final production deployment verification.

## Local environment note

Accidental duplicate generated Next.js type files (`* 2.ts`) were found in `.next/types`. Initial copies were moved recoverably to `/tmp/forma-generated-types.5m1DKY`; duplicates reappeared. `tsconfig.json` excludes only that duplicate generated-file pattern while retaining normal Next.js generated types and all source checks.

## Remaining risks

- Existing ranking matching uses substring semantics; the timeline's stronger boundaries can honestly report a stored match without inspectable support. This implementation intentionally does not change the ranking engine.
- Analysis-wide pgvector top-k may omit some selected-candidate supporting context. Deterministic selected references mitigate this, but a dedicated selected-candidate RPC could improve semantic recall if live tests show omissions.
- Page/section provenance is only as complete as existing extraction metadata. No fake PDF viewer or inferred page mapping was added.
- Very large source sets require additional pagination and data transfer; there is no persistent evidence cache yet.
- Figma requires reconnecting. A signed-in completed analysis is needed for real-data browser/RAG sign-off.
