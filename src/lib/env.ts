export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }

  return { url, key };
}

export function hasR2Env() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

export function hasOpenAIEnv() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasOcrEnv() {
  return (process.env.OCR_PROVIDER ?? "openai") === "openai" && hasOpenAIEnv();
}

export function getMaxResumesPerAnalysis() {
  const configured = Number(
    process.env.MAX_RESUMES_PER_ANALYSIS ??
      process.env.NEXT_PUBLIC_MAX_RESUMES_PER_ANALYSIS ??
      100,
  );
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 250)
    : 100;
}

export function getUploadConcurrency() {
  const configured = Number(process.env.NEXT_PUBLIC_UPLOAD_CONCURRENCY ?? 4);
  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 8)
    : 4;
}
