"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "idle" | "listening" | "processing" | "speaking" | "error";

const LANGUAGES = [
  { code: "ja", label: "Japanese" },
  { code: "es", label: "Spanish" },
  { code: "zh", label: "Chinese" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
];

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState("ja");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<number | null>(null);

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
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
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
        await requestDubbing(audioBlob);
      };

      recorder.start();
      setPhase("listening");

      autoStopTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") {
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
      recorderRef.current.stop();
    }
    setPhase("processing");
  };

  const requestDubbing = async (audioBlob: Blob) => {
    setPhase("processing");
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "bowtie.webm");
      formData.append("target_lang", targetLang);

      const response = await fetch("/api/dub", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Dubbing failed.");
      }

      const contentType = response.headers.get("content-type") || "audio/mpeg";
      const buffer = await response.arrayBuffer();
      const dubbedAudio = new Blob([buffer], { type: contentType });
      const audioUrl = URL.createObjectURL(dubbedAudio);

      const audio = new Audio(audioUrl);
      setPhase("speaking");
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setPhase("idle");
      };
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Dubbing failed."
      );
      setPhase("error");
    }
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
      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <header className="space-y-4">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald-200/70">
            Bowtie Dubbing Lab
          </p>
          <h1 className="font-display text-4xl leading-tight text-slate-100 md:text-5xl">
            A voice-changing bowtie that translates your speech out loud.
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-300">
            Click the bowtie, speak naturally, and hear a dubbed translation with
            ElevenLabs. It&apos;s designed for fast pronunciation checks and
            instant feedback.
          </p>
        </header>

        <section className="flex w-full flex-col items-center gap-8">
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

          <div className="flex flex-col items-center gap-3 text-sm text-slate-300">
            <p className="text-base font-medium text-slate-100">{statusLabel}</p>
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-full bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-200">
              <span>Target language</span>
              <select
                className="rounded-full bg-transparent px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/20 focus:outline-none"
                value={targetLang}
                onChange={(event) => setTargetLang(event.target.value)}
              >
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </div>
            {errorMessage ? (
              <p className="text-sm text-rose-200">{errorMessage}</p>
            ) : null}
          </div>
        </section>

        <footer className="flex flex-col items-center gap-2 text-xs text-slate-400">
          <p>Tip: click once to start listening, click again to stop early.</p>
          <p>All audio stays in-session and is sent only to ElevenLabs for dubbing.</p>
        </footer>
      </main>
    </div>
  );
}
