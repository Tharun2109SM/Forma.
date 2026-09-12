import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  isDemo: boolean;
};

export async function getViewer(): Promise<Viewer | null> {
  if (!hasSupabaseEnv()) {
    return {
      id: "demo-user",
      email: "recruiter@demo.forma",
      fullName: "Demo Recruiter",
      isDemo: true,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const id = typeof claims?.sub === "string" ? claims.sub : null;

  if (error || !id) {
    return null;
  }

  const email = typeof claims?.email === "string" ? claims.email : "";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", id)
    .maybeSingle();

  return {
    id,
    email: profile?.email ?? email,
    fullName: profile?.full_name ?? email.split("@")[0] ?? "Recruiter",
    isDemo: false,
  };
}
