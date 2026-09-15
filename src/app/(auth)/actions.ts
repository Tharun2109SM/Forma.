"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
};

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name."),
  password: z.string().min(8, "Use at least 8 characters."),
});

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the information and try again.";
}

export async function loginAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  if (!hasSupabaseEnv()) {
    redirect("/app?demo=1");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "That email and password combination was not accepted." };
  }

  redirect("/app");
}

export async function signupAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }

  if (!hasSupabaseEnv()) {
    redirect("/app?demo=1");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: siteUrl
        ? `${siteUrl.replace(/\/$/, "")}/auth/confirm?next=/dashboard`
        : undefined,
    },
  });

  if (error) {
    return {
      error: "We could not create that account. Check the details or try another email.",
    };
  }

  if (data.session) {
    redirect("/app");
  }

  return {
    message: "Check your email to confirm your account, then return to sign in.",
  };
}

export async function signOutAction() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
