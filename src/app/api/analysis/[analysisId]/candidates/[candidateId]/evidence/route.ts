import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  EvidenceError,
  loadCandidateEvidenceBatch,
} from "@/lib/evidence/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisId: string; candidateId: string }> },
) {
  const parsed = z
    .object({ analysisId: z.uuid(), candidateId: z.uuid() })
    .safeParse(await params);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid candidate." }, { status: 400 });
  try {
    const result = await loadCandidateEvidenceBatch(
      await createClient(),
      parsed.data.analysisId,
      [parsed.data.candidateId],
    );
    return NextResponse.json(result.candidates[0], {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof EvidenceError
            ? error.message
            : "Evidence is temporarily unavailable.",
      },
      { status: error instanceof EvidenceError ? error.status : 502 },
    );
  }
}
