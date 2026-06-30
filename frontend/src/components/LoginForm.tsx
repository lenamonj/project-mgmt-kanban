"use client";

import { useState } from "react";
import { login, register } from "@/lib/api";

type Mode = "signin" | "signup";

export const LoginForm = ({ onAuthed }: { onAuthed: () => void }) => {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await register(username, password);
      } else {
        await login(username, password);
      }
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  };

  const isSignup = mode === "signup";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <form
        onSubmit={handleSubmit}
        data-testid="login-form"
        className="relative flex w-full max-w-sm flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/85 p-8 shadow-[var(--shadow)] backdrop-blur"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Project Management Studio
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            {isSignup ? "Create account" : "Sign in"}
          </h1>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-[var(--navy-dark)]">
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--primary-blue)]"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-[var(--navy-dark)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm outline-none focus:border-[var(--primary-blue)]"
          />
        </label>

        {error ? (
          <p role="alert" data-testid="login-error" className="text-sm font-medium text-[var(--secondary-purple)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {submitting
            ? isSignup
              ? "Creating..."
              : "Signing in..."
            : isSignup
              ? "Create account"
              : "Sign in"}
        </button>

        <button
          type="button"
          onClick={toggleMode}
          data-testid="toggle-auth-mode"
          className="text-center text-xs font-semibold text-[var(--primary-blue)] transition hover:text-[var(--secondary-purple)]"
        >
          {isSignup
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
};
