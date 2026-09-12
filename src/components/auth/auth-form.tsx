"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthState } from "@/app/(auth)/actions";

type AuthAction = (state: AuthState, formData: FormData) => Promise<AuthState>;

function SubmitButton({ mode }: { mode: "login" | "signup" }) {
  const { pending } = useFormStatus();
  const label = mode === "login" ? "Sign in" : "Create account";

  return (
    <button className="auth-submit" disabled={pending} type="submit">
      {pending ? (
        <>
          <LoaderCircle className="spin" size={16} /> Working…
        </>
      ) : (
        <>
          {label} <ArrowRight size={16} strokeWidth={1.8} />
        </>
      )}
    </button>
  );
}

export function AuthForm({
  action,
  demoMode,
  initialError,
  mode,
}: {
  action: AuthAction;
  demoMode: boolean;
  initialError?: string;
  mode: "login" | "signup";
}) {
  const [state, formAction] = useActionState(action, {});
  const isLogin = mode === "login";
  const visibleError = state.error ?? initialError;

  return (
    <form action={formAction} className="auth-form">
      {!isLogin && (
        <label>
          <span>Full name</span>
          <input
            autoComplete="name"
            name="fullName"
            placeholder="Arjun Sharma"
            required
            type="text"
          />
        </label>
      )}
      <label>
        <span>Work email</span>
        <input
          autoComplete="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
      </label>
      <label>
        <span>Password</span>
        <input
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? 1 : 8}
          name="password"
          placeholder={isLogin ? "Your password" : "At least 8 characters"}
          required
          type="password"
        />
      </label>

      <div aria-live="polite" className="auth-message" id="auth-status">
        {visibleError && <p className="form-error">{visibleError}</p>}
        {state.message && <p className="form-success">{state.message}</p>}
        {demoMode && !visibleError && !state.message && (
          <p className="demo-note">
            Demo mode is active. Any valid details open the sample workspace.
          </p>
        )}
      </div>

      <SubmitButton mode={mode} />

      <p className="auth-switch">
        {isLogin ? "New to Forma.?" : "Already have an account?"}{" "}
        <Link href={isLogin ? "/signup" : "/login"}>
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
