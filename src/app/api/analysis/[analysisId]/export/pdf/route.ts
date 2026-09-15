import { createClient } from "@/lib/supabase/server";
import { exportPdfResponse } from "@/lib/reports/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ analysisId: string }> }) {
  try {
    const { analysisId } = await params;
    return await exportPdfResponse(request, analysisId, await createClient());
  } catch {
    return Response.json({ error: "Report could not be generated. Your analysis has not been changed. Try again." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
