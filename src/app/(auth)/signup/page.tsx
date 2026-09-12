import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { hasSupabaseEnv } from "@/lib/env";
import { signupAction } from "../actions";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <section className="auth-card" aria-labelledby="signup-title">
      <div className="auth-intro">
        <span className="auth-index">AUTH / 002</span>
        <h1 id="signup-title">Create your account.</h1>
        <p>One workspace for every explainable candidate shortlist.</p>
      </div>
      <AuthForm action={signupAction} demoMode={!hasSupabaseEnv()} mode="signup" />
    </section>
  );
}
