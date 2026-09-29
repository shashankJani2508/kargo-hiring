"use client";

import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (res.ok) window.location.href = "/";
    else setError("That password isn't right.");
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between bg-sidebar text-white p-12">
        <Wordmark />
        <div className="max-w-md">
          <p className="text-[13px] uppercase tracking-[0.14em] text-white/40">Hiring, decided</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.15] tracking-tight">
            Every CV read. Every candidate ranked. Every reply sent.
          </h1>
          <p className="mt-5 text-white/55 leading-relaxed">
            Kargo&apos;s rubric scores each application against the pattern in your best hires. You look, decide, and move — in minutes, not weekends.
          </p>
        </div>
        <p className="text-xs text-white/30">Rubric v3 · PM & Senior PM</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden mb-10 text-ink"><Wordmark dark /></div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted">Enter the dashboard password to continue.</p>
          <label className="mt-8 block text-xs font-medium text-ink-2">Password</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 h-11 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10 transition">
            <Lock className="size-4 text-faint" />
            <input
              type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm" placeholder="••••••••"
            />
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          <button
            disabled={busy || !password}
            className="mt-6 w-full h-11 rounded-xl bg-accent text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent-hover disabled:opacity-50 transition"
          >
            {busy ? "Signing in…" : "Continue"} <ArrowRight className="size-4" />
          </button>
        </form>
      </section>
    </main>
  );
}

function Wordmark({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`size-8 rounded-lg grid place-items-center ${dark ? "bg-ink text-white" : "bg-white text-ink"}`}>
        <span className="text-[15px] font-bold">K</span>
      </div>
      <span className="text-[15px] font-semibold tracking-tight">Kargo <span className="opacity-40 font-normal">Hiring</span></span>
    </div>
  );
}
