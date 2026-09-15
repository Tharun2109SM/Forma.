# Forma. PDF reports — implementation and verification

## Implemented surfaces

- Analysis header: Full shortlist, Top candidates, and Ranking table PDF choices.
- Candidate detail drawer: Candidate report.
- Candidate comparison workspace: Comparison report.

All downloads use `GET /api/analysis/[analysisId]/export/pdf`. The report type and, where required, route-derived candidate IDs are the only client inputs. The endpoint does not update candidates, scores, ranks, or analysis state.

## Data and security contract

- The server authenticates with the request-scoped Supabase client and verifies `analyses.user_id` before loading candidates.
- Reports are limited to completed analyses. Candidate and comparison exports independently verify every selected candidate belongs to the owned analysis.
- Candidate retrieval is paginated and retains persisted ordering, nullable scores, matched skills, and not-evidenced requirements. Missing values render as `N/A`; ranks and scores are never recomputed.
- A final analysis ownership/status/version check prevents a restarted or changed analysis from producing a mixed report.
- Responses are private, non-cacheable PDF attachments with sanitized filenames. Controlled errors never expose database details or secrets.
- Document provenance comes only from stored candidate documents/chunks. Page and section labels are omitted when unavailable, and absence language is limited to “Not evidenced.”

## Report engine

`src/lib/reports/pdf.ts` is the shared server-side PDF renderer. It uses an embedded, subsetted Geist font and has no browser, screenshot, print-dialog, external-network, or LLM dependency. Reports include Forma. branding, analysis metadata, the configured 50/30/20 scoring methodology, page numbers, persisted rankings, and source references where available.

The production function traces the bundled font through `next.config.ts`, making generation compatible with Vercel's server runtime.

## Verification completed

- 52 automated tests pass, including authentication/ownership, cross-analysis selection, interrupted-analysis consistency, sanitized filenames, null scores, real provenance, unsafe legacy absence wording, and 18/50/100-candidate pagination.
- ESLint, TypeScript, and the optimized Next.js production build pass.
- Four report variants were generated from the existing 18-candidate analysis data and every rendered page was visually reviewed: 9-page shortlist, 2-page ranking, 3-page candidate, and 5-page comparison.
- The local signed-in analysis displays the report control for the completed 18-candidate analysis.
- An isolated browser harness verified successful download feedback for all three analysis choices, the candidate report, and the comparison report. The report sheet was also visually checked at 390×844.
- Request-scoped database checks confirmed the analysis and all 18 candidates are visible to the owner and hidden from an unrelated authenticated user. Those checks were rolled back and made no data changes.

## Deployment status

Implemented and production-build verified locally. No production deployment was performed as part of this change.
