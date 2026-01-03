"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "idle" | "listening" | "processing" | "speaking" | "error";
type HistoryStatus = "processing" | "ready" | "error";
type HistoryEntry = {
  id: string;
  createdAt: string;
  targetLang: string;
  inputUrl: string;
  outputUrl?: string;
  status: HistoryStatus;
  errorMessage?: string;
};

const LANGUAGES = [
  { code: "en", label: "English (US)", enabled: true },
  { code: "ja", label: "Japanese", enabled: true },
  { code: "es", label: "Spanish", enabled: true },
  { code: "zh", label: "Chinese", enabled: true },
  { code: "pt", label: "Portuguese", enabled: true },
  { code: "it", label: "Italian (coming soon)", enabled: false },
  { code: "de", label: "German", enabled: true },
  { code: "ko", label: "Korean", enabled: true },
  { code: "fr", label: "French", enabled: true },
];
const MAX_HISTORY = 5;

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState("ja");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [playbackRate, setPlaybackRate] = useState(0.9);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<number | null>(null);
  const log = (...args: unknown[]) => console.info("[bowtie]", ...args);

  const revokeEntry = (entry: HistoryEntry) => {
    URL.revokeObjectURL(entry.inputUrl);
    if (entry.outputUrl) {
      URL.revokeObjectURL(entry.outputUrl);
    }
  };

  const addHistoryEntry = (entry: HistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev];
      if (next.length > MAX_HISTORY) {
        const removed = next.slice(MAX_HISTORY);
        removed.forEach(revokeEntry);
        return next.slice(0, MAX_HISTORY);
      }
      return next;
    });
  };

  const updateHistoryEntry = (id: string, updates: Partial<HistoryEntry>) => {
    setHistory((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
    );
  };

  const statusLabel = useMemo(() => {
    switch (phase) {
      case "listening":
        return "Listening… Speak into the bowtie.";
      case "processing":
        return "Translating and dubbing… gears engaged.";
      case "speaking":
        return "Bowtie speaking back.";
      case "error":
        return "Something went wrong. Try again.";
      default:
        return "Tap the bowtie to start.";
    }
  }, [phase]);

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        window.clearTimeout(autoStopTimerRef.current);
      }
      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      history.forEach(revokeEntry);
    };
  }, [history]);

  const startRecording = async () => {
    setErrorMessage(null);
    log("Requesting microphone access.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        if (audioBlob.size === 0) {
          setPhase("idle");
          return;
        }
        const entryId = crypto.randomUUID();
        const inputUrl = URL.createObjectURL(audioBlob);
        addHistoryEntry({
          id: entryId,
          createdAt: new Date().toISOString(),
          targetLang,
          inputUrl,
          status: "processing",
        });
        await requestDubbing(audioBlob, entryId);
      };

      recorder.start();
      setPhase("listening");
      log("Recording started.");

      autoStopTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") {
          log("Auto-stopping recording after timeout.");
          recorder.stop();
        }
      }, 5000);
    } catch (error) {
      console.error(error);
      setErrorMessage("Microphone access denied.");
      setPhase("error");
    }
  };

  const stopRecording = () => {
    if (autoStopTimerRef.current) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      log("Manual stop requested.");
      recorderRef.current.stop();
    }
    setPhase("processing");
  };

  const requestDubbing = async (audioBlob: Blob, entryId: string) => {
    setPhase("processing");
    try {
      log("Uploading audio for dubbing.", {
        size: audioBlob.size,
        type: audioBlob.type,
        targetLang,
      });
      updateHistoryEntry(entryId, { status: "processing", errorMessage: undefined });
      const formData = new FormData();
      formData.append("audio", audioBlob, "bowtie.webm");
      formData.append("target_lang", targetLang);

      const response = await fetch("/api/dub", {
        method: "POST",
        body: formData,
      });

      if (response.status === 202) {
        const payload = await response.json().catch(() => null);
        const dubbingId = payload?.dubbing_id as string | undefined;
        log("Dubbing still processing, switching to status polling.", {
          dubbingId,
          status: payload?.status,
        });
        if (!dubbingId) {
          throw new Error(payload?.error || "Dubbing failed.");
        }
        await pollDubbingStatus(dubbingId, entryId);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        log("Dubbing request failed.", {
          status: response.status,
          error: payload?.error,
        });
        throw new Error(payload?.error || "Dubbing failed.");
      }

      const contentType = response.headers.get("content-type") || "audio/mpeg";
      const buffer = await response.arrayBuffer();
      const dubbedAudio = new Blob([buffer], { type: contentType });
      const audioUrl = URL.createObjectURL(dubbedAudio);
      updateHistoryEntry(entryId, { outputUrl: audioUrl, status: "ready" });

      const audio = new Audio(audioUrl);
      setPhase("speaking");
      audio.playbackRate = playbackRate;
      log("Playing dubbed audio.");
      audio.play();
      audio.onended = () => {
        setPhase("idle");
        log("Playback finished.");
      };
    } catch (error) {
      console.error(error);
      updateHistoryEntry(entryId, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Dubbing failed.",
      });
      setErrorMessage(
        error instanceof Error ? error.message : "Dubbing failed."
      );
      setPhase("error");
    }
  };

  const pollDubbingStatus = async (dubbingId: string, entryId: string) => {
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      log("Polling dubbing status.", { attempt: attempt + 1, dubbingId });
      const response = await fetch(
        `/api/dub/status?dubbing_id=${encodeURIComponent(
          dubbingId
        )}&target_lang=${encodeURIComponent(targetLang)}`
      );

      if (response.status === 202) {
        const payload = await response.json().catch(() => null);
        log("Dubbing still processing.", {
          attempt: attempt + 1,
          status: payload?.status,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        log("Status polling failed.", {
          status: response.status,
          error: payload?.error,
        });
        throw new Error(payload?.error || "Dubbing failed.");
      }

      const contentType = response.headers.get("content-type") || "audio/mpeg";
      const buffer = await response.arrayBuffer();
      const dubbedAudio = new Blob([buffer], { type: contentType });
      const audioUrl = URL.createObjectURL(dubbedAudio);
      updateHistoryEntry(entryId, { outputUrl: audioUrl, status: "ready" });

      const audio = new Audio(audioUrl);
      setPhase("speaking");
      audio.playbackRate = playbackRate;
      log("Playing dubbed audio from status poll.");
      audio.play();
      audio.onended = () => {
        setPhase("idle");
        log("Playback finished.");
      };
      return;
    }

    throw new Error("Dubbing is still processing.");
  };

  const playUrl = (url?: string) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    audio.play();
  };

  const handleBowtieClick = () => {
    if (phase === "idle" || phase === "error") {
      void startRecording();
      return;
    }
    if (phase === "listening") {
      stopRecording();
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full glow-orb" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-96 w-96 rounded-full glow-orb" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-6 py-16 text-center lg:flex-row lg:items-start lg:text-left">
        <div className="flex w-full flex-col items-center gap-10 lg:flex-1 lg:items-start">
          <header className="space-y-4">
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-200/70">
              Bowtie Dubbing Lab
            </p>
            <h1 className="font-display text-4xl leading-tight text-slate-100 md:text-5xl">
              A voice-changing bowtie that translates your speech out loud.
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-300 lg:mx-0">
              Click the bowtie, speak naturally, and hear a dubbed translation
              with ElevenLabs. It&apos;s designed for fast pronunciation checks
              and instant feedback.
            </p>
          </header>

          <section className="flex w-full flex-col items-center gap-8 lg:items-start">
            <div
              className={`bowtie-wrap ${
                phase === "listening" ? "bowtie-listening" : ""
              } ${phase === "processing" ? "bowtie-processing" : ""} ${
                phase === "speaking" ? "bowtie-speaking" : ""
              }`}
            >
              <button
                type="button"
                onClick={handleBowtieClick}
                className="relative grid h-full w-full place-items-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.15),_rgba(8,7,12,0.4))] shadow-[0_0_50px_rgba(12,255,255,0.2)] transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
                aria-pressed={phase === "listening"}
              >
                <span className="sr-only">Activate bowtie microphone</span>
                <div className="bowtie-wing left" />
                <div className="bowtie-wing right" />
                <div className="bowtie-gear left" />
                <div className="bowtie-gear right" />
                <div className="bowtie-core" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 text-sm text-slate-300 lg:items-start">
              <p className="text-base font-medium text-slate-100">
                {statusLabel}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-full bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 lg:justify-start">
                <span>Target language</span>
                <select
                  className="rounded-full bg-transparent px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/20 focus:outline-none"
                  value={targetLang}
                  onChange={(event) => setTargetLang(event.target.value)}
                >
                  {LANGUAGES.map((language) => (
                    <option
                      key={language.code}
                      value={language.code}
                      disabled={!language.enabled}
                    >
                      {language.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-200">
                <span>Playback speed</span>
                <select
                  className="rounded-full bg-transparent px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/20 focus:outline-none"
                  value={playbackRate}
                  onChange={(event) =>
                    setPlaybackRate(Number(event.target.value))
                  }
                >
                  <option value={0.85}>0.85x</option>
                  <option value={0.9}>0.9x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.1}>1.1x</option>
                </select>
              </div>
              {errorMessage ? (
                <p className="text-sm text-rose-200">{errorMessage}</p>
              ) : null}
            </div>
          </section>

          <footer className="flex flex-col items-center gap-2 text-xs text-slate-400 lg:items-start">
            <p>Tip: click once to start listening, click again to stop early.</p>
            <p>
              All audio stays in-session and is sent only to ElevenLabs for
              dubbing.
            </p>
          </footer>
        </div>

        <aside className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-[0_20px_50px_rgba(10,12,28,0.5)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-200">
              Session history
            </h2>
            <span className="text-xs text-slate-400">
              {history.length}/{MAX_HISTORY}
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">
                No recordings yet. Tap the bowtie to capture your first clip.
              </p>
            ) : (
              history.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>
                      {
                        LANGUAGES.find(
                          (language) => language.code === entry.targetLang
                        )?.label
                      }
                    </span>
                    <span>
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => playUrl(entry.inputUrl)}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                    >
                      Play input
                    </button>
                    <button
                      type="button"
                      onClick={() => playUrl(entry.outputUrl)}
                      disabled={!entry.outputUrl}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {entry.outputUrl ? "Play output" : "Output pending"}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {entry.status === "processing"
                      ? "Dubbing in progress…"
                      : entry.status === "ready"
                      ? "Dub ready."
                      : entry.errorMessage || "Dubbing failed."}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
