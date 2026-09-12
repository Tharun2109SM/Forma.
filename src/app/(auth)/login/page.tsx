import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { hasSupabaseEnv } from "@/lib/env";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const confirmationError =
    query.error === "confirmation"
      ? "That confirmation link is invalid or has expired. Request a new one by creating your account again."
      : undefined;

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-intro">
        <span className="auth-index">AUTH / 001</span>
        <h1 id="login-title">Welcome back.</h1>
        <p>Sign in to reopen your shortlists and start a new analysis.</p>
      </div>
      <AuthForm
        action={loginAction}
        demoMode={!hasSupabaseEnv()}
        initialError={confirmationError}
        mode="login"
      />
    </section>
  );
}
