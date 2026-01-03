"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => searchParams.get("next") || "/",
    [searchParams]
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Authentication failed.");
      }

      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full glow-orb" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-96 w-96 rounded-full glow-orb" />
      <div className="relative grid w-full max-w-4xl gap-10 rounded-3xl border border-white/10 bg-[rgba(12,14,24,0.85)] p-10 shadow-[0_30px_80px_rgba(8,8,20,0.6)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">
            Bowtie Dubbing Lab
          </p>
          <h1 className="font-display text-4xl text-slate-100">
            Only one truth. Do you have what it takes?
          </h1>
          <p className="text-base leading-relaxed text-slate-300">
            Enter the shared passphrase to unlock the voice-changing bowtie and
            test your pronunciation.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-xs uppercase tracking-[0.3em] text-slate-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-base text-slate-100 outline-none ring-1 ring-transparent transition focus:ring-cyan-200/60"
              placeholder="Shared password"
              required
            />
            {error ? <p className="text-sm text-rose-200">{error}</p> : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-100 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Checking…" : "Enter"}
            </button>
          </form>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,_rgba(102,242,255,0.35),_rgba(102,242,255,0))] blur-2xl" />
          <Image
            src="/images/conan.webp"
            alt="Detective Conan pointing forward"
            width={360}
            height={360}
            className="relative h-auto w-full max-w-xs drop-shadow-[0_20px_40px_rgba(6,10,24,0.7)]"
            priority
          />
        </div>
      </div>
    </div>
  );
}
