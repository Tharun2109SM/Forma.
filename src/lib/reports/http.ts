import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { EvidenceError } from "@/lib/evidence/service";
import { loadFormaReport } from "./service";
import { renderFormaReport } from "./pdf";
import { parseReportSelection, ReportError, reportFilename } from "./selection";

// Factored handler allows authorization/error tests without Next's cookie runtime.
export async function exportPdfResponse(request: Request, analysisId: string, supabase: SupabaseClient<Database>) {
  try {
    const selection = parseReportSelection(new URL(request.url).searchParams);
    const report = await loadFormaReport(supabase, analysisId, selection);
    const bytes = await renderFormaReport(report);
    const filename = reportFilename(selection.type === "candidate" ? report.candidates[0].name : report.analysis.jobTitle || report.analysis.title, selection.type);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    const known = error instanceof ReportError || error instanceof EvidenceError;
    return Response.json({ error: known ? error.message : "Report could not be generated. Your analysis has not been changed. Try again." }, {
      status: known ? error.status : 500, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
