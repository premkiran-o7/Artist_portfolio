"use client";

import { useState, type FormEvent } from "react";
import { adminFetch } from "@/lib/adminFetch";

type Status = "idle" | "pending";

const inputClass =
  "border border-[var(--rule)] bg-transparent px-3 py-2 text-[var(--ink)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

const labelClass =
  "font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink-dim)]";

/**
 * Admin sign-in. Sits on solid --ground (no video behind it, unlike the hero), so
 * --ink-dim is contrast-safe here for secondary text.
 *
 * On success this does a hard navigation (window.location.href) rather than the
 * router's client-side push. That guarantees the browser re-requests
 * /admin/dashboard as a real navigation carrying the cookie the login response
 * just set, with nothing left over from the pre-auth page's client state.
 */
export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Guards against double-submit — e.g. a fast double-click — re-firing the
    // request while one is already in flight, which is exactly how you trip
    // your own 15-minute lockout.
    if (status === "pending") return;

    setStatus("pending");
    setError(null);

    let res: Response;
    try {
      res = await adminFetch("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
      return;
    }

    if (res.ok) {
      window.location.href = "/admin/dashboard";
      return; // stay disabled through the navigation
    }

    if (res.status === 401) {
      setError("Incorrect username or password");
    } else if (res.status === 429) {
      setError("Too many attempts. Try again in 15 minutes.");
    } else {
      setError("Something went wrong. Please try again.");
    }
    setStatus("idle");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Admin
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-dim)]">Sign in to manage the site.</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className={labelClass}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <p role="alert" className="min-h-5 text-sm text-[var(--accent)]">
            {error}
          </p>

          <button
            type="submit"
            disabled={status === "pending"}
            className="mt-2 border border-[var(--rule)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--ink)] hover:border-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "pending" ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
