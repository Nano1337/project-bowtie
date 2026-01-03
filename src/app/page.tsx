"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "idle" | "listening" | "processing" | "speaking" | "error";
type HistoryStatus = "processing" | "ready" | "error";
type HistoryEntry = {
  id: string;
  createdAt: string;
  targetLang: string;
  inputMime: string;
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
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showHistory, setShowHistory] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<number | null>(null);
  const log = (...args: unknown[]) => console.info("[bowtie]", ...args);
  const inputMimeRef = useRef<string>("");
  const historyRef = useRef<HistoryEntry[]>([]);
  const playbackOptions = [0.75, 0.9, 1.0, 1.1, 1.25] as const;

  const convertToWav = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextImpl =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioContextImpl();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBuffer = encodeWav(audioBuffer);
    await audioContext.close();
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const encodeWav = (audioBuffer: AudioBuffer) => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const numFrames = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = numFrames * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numFrames; i += 1) {
      for (let channel = 0; channel < numChannels; channel += 1) {
        const sample = audioBuffer.getChannelData(channel)[i] ?? 0;
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(
          offset,
          clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return buffer;
  };

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
        return "Listening…";
      case "processing":
        return "Translating…";
      case "speaking":
        return "Speaking…";
      case "error":
        return "Try again.";
      default:
        return "Tap the bowtie to start.";
    }
  }, [phase]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) {
        window.clearTimeout(autoStopTimerRef.current);
      }
      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      historyRef.current.forEach(revokeEntry);
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    log("Requesting microphone access.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ];
      const mimeType =
        mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) ||
        "";
      inputMimeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
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

        const resolvedMime =
          recorder.mimeType || inputMimeRef.current || "audio/webm";
        const recordedBlob = new Blob(chunksRef.current, { type: resolvedMime });
        chunksRef.current = [];
        if (recordedBlob.size === 0) {
          setPhase("idle");
          return;
        }

        let wavBlob: Blob;
        try {
          wavBlob = await convertToWav(recordedBlob);
        } catch (err) {
          console.error(err);
          setErrorMessage("Audio conversion failed. Try again.");
          setPhase("error");
          return;
        }

        const entryId = crypto.randomUUID();
        const inputUrl = URL.createObjectURL(wavBlob);
        addHistoryEntry({
          id: entryId,
          createdAt: new Date().toISOString(),
          targetLang,
          inputMime: wavBlob.type,
          inputUrl,
          status: "processing",
        });
        await requestDubbing(wavBlob, entryId);
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
      formData.append("audio", audioBlob, "bowtie.wav");
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
        const errorMessage =
          typeof payload?.error === "string"
            ? payload.error
            : typeof payload?.detail === "string"
            ? payload.detail
            : payload
            ? JSON.stringify(payload)
            : "Dubbing failed.";
        log("Dubbing request failed.", {
          status: response.status,
          error: payload?.error ?? payload?.detail ?? payload,
        });
        throw new Error(errorMessage);
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
        const errorMessage =
          typeof payload?.error === "string"
            ? payload.error
            : typeof payload?.detail === "string"
            ? payload.detail
            : payload
            ? JSON.stringify(payload)
            : "Dubbing failed.";
        log("Status polling failed.", {
          status: response.status,
          error: payload?.error ?? payload?.detail ?? payload,
        });
        throw new Error(errorMessage);
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

  const playUrl = async (url?: string) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    try {
      await audio.play();
    } catch (err) {
      console.error(err);
      setErrorMessage("Audio playback failed on this browser.");
    }
  };

  const clearHistory = () => {
    setHistory((prev) => {
      prev.forEach(revokeEntry);
      return [];
    });
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
      <div className="pointer-events-none absolute inset-0 comic-dots" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
        <nav className="absolute left-0 right-0 top-8 mx-auto flex w-full max-w-6xl items-center justify-between px-6">
          <span className="text-sm uppercase tracking-[0.35em] text-blue-700/80">
            Detective Conan
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              className="rounded-full border-2 border-blue-200 bg-yellow-200/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-blue-900 shadow-[0_8px_18px_rgba(47,93,255,0.25)] transition hover:-translate-y-0.5 hover:bg-yellow-200"
              aria-expanded={showHistory}
              aria-controls="history-panel"
            >
              History {history.length ? `(${history.length})` : ""}
            </button>
            <div
              id="history-panel"
              className={`absolute right-0 z-10 mt-3 w-[320px] rounded-2xl border-2 border-blue-100 bg-white/95 p-4 text-left shadow-[0_24px_60px_rgba(47,93,255,0.25)] transition ${
                showHistory ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
              }`}
            >
              <div className="flex items-center justify-between text-sm text-blue-900">
                <span className="uppercase tracking-[0.2em]">Session history</span>
                <div className="flex items-center gap-2 text-blue-600">
                  <span>
                    {history.length}/{MAX_HISTORY}
                  </span>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 transition hover:bg-blue-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {history.length === 0 ? (
                  <p className="text-base text-blue-700">
                    No recordings yet. Tap the bowtie to capture your first clip.
                  </p>
                ) : (
                  history.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-blue-100 bg-blue-50/70 p-3"
                    >
                      <div className="flex items-center justify-between text-sm text-blue-800">
                        <span>
                          {
                            LANGUAGES.find(
                              (language) => language.code === entry.targetLang
                            )?.label
                          }
                        </span>
                        <span className="text-blue-500 text-sm">
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-blue-500">
                        Target language:{" "}
                        {
                          LANGUAGES.find(
                            (language) => language.code === entry.targetLang
                          )?.label
                        }
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => playUrl(entry.inputUrl)}
                          className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-semibold text-blue-900 transition hover:-translate-y-0.5 hover:bg-blue-50"
                        >
                          Play input
                        </button>
                        <button
                          type="button"
                          onClick={() => playUrl(entry.outputUrl)}
                          disabled={!entry.outputUrl}
                          className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-semibold text-blue-900 transition hover:-translate-y-0.5 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {entry.outputUrl ? "Play output" : "Output pending"}
                        </button>
                      </div>
                      <div className="mt-2 text-sm text-blue-600">
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
            </div>
          </div>
        </nav>

        <div className="flex w-full flex-col items-center gap-10">
          <header className="space-y-4">
            <h1 className="font-display text-4xl leading-tight text-blue-900 md:text-5xl">
              There is always only one truth!
            </h1>
            <p className="mx-auto max-w-lg text-base leading-relaxed text-blue-800">
              One truth prevails. Let it speak in a new language.
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
                className="relative grid h-full w-full place-items-center rounded-full border-4 border-blue-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(191,226,255,0.3))] shadow-[0_24px_50px_rgba(47,93,255,0.25)] transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200"
                aria-pressed={phase === "listening"}
              >
                <span className="sr-only">Activate bowtie microphone</span>
                <div className="bowtie-signal" />
                <img
                  src="/images/bow.png"
                  alt="Detective Conan bowtie"
                  className="bowtie-image"
                />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 text-base text-blue-800">
              <p className="text-lg font-medium text-blue-900">
                {statusLabel}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm uppercase tracking-[0.18em] text-blue-700 shadow-[0_10px_20px_rgba(47,93,255,0.12)]">
                <span>Target language</span>
                <select
                  className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-900 ring-2 ring-blue-100 focus:outline-none"
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
              <div className="flex flex-col items-center gap-2 text-sm uppercase tracking-[0.18em] text-blue-700">
                <span>Playback speed</span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={playbackOptions.indexOf(playbackRate)}
                    onChange={(event) => {
                      const next =
                        playbackOptions[Number(event.target.value)] ?? 1.0;
                      setPlaybackRate(next);
                    }}
                    className="h-2 w-40 accent-yellow-300"
                  />
                  <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-semibold text-blue-900">
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>
              </div>
              {errorMessage ? (
                <p className="text-base text-red-500">{errorMessage}</p>
              ) : null}
            </div>
          </section>

          <footer className="flex flex-col items-center gap-2 text-sm text-blue-700">
            <p>Tap again to stop early.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
