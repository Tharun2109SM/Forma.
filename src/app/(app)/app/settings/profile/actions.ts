"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
});

export async function updateProfile(formData: FormData) {
  if (!hasSupabaseEnv()) redirect("/app/settings/profile?notice=sample");
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) redirect("/app/settings/profile?notice=invalid");
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) redirect("/app/settings/profile?notice=error");
  revalidatePath("/app", "layout");
  redirect("/app/settings/profile?notice=saved");
}
