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
      <div className="pointer-events-none absolute inset-0 comic-dots" />
      <div className="relative flex w-full max-w-3xl flex-col items-center gap-8 rounded-3xl border-2 border-blue-100 bg-white/90 px-8 py-12 text-center shadow-[0_30px_80px_rgba(47,93,255,0.25)]">
        <h1 className="font-display text-4xl text-blue-900 md:text-5xl">
          One truth prevails. Do you have what it takes?
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-blue-800">
          Enter the shared passphrase to unlock the voice-changing bowtie and
          test your pronunciation.
        </p>
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,_rgba(255,211,77,0.45),_rgba(255,211,77,0))] blur-2xl" />
          <Image
            src="/images/conan.png"
            alt="Detective Conan pointing forward"
            width={520}
            height={520}
            className="relative h-auto w-full max-w-sm drop-shadow-[0_20px_40px_rgba(6,10,24,0.7)] md:max-w-md"
            priority
          />
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
          <label className="block text-xs uppercase tracking-[0.3em] text-blue-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border-2 border-blue-100 bg-white px-4 py-3 text-base text-blue-900 outline-none ring-2 ring-transparent transition focus:ring-yellow-200"
            placeholder="Shared password"
            required
          />
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full border-2 border-blue-200 bg-yellow-200 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-blue-900 transition hover:-translate-y-0.5 hover:bg-yellow-200/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
