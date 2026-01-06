"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = "idle" | "listening" | "processing" | "transcribing" | "speaking" | "error";
type HistoryStatus = "processing" | "ready" | "error";
type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};
type HistoryEntry = {
  id: string;
  createdAt: string;
  targetLang: string;
  inputMime: string;
  inputUrl: string;
  outputUrl?: string;
  status: HistoryStatus;
  errorMessage?: string;
  transcript?: TranscriptWord[];
};

// ElevenLabs dubbing API accepts ISO 639-1 codes
const LANGUAGES = [
  { code: "en", label: "English", enabled: true },
  { code: "ja", label: "Japanese", enabled: true },
  { code: "es", label: "Spanish", enabled: true },
  { code: "zh", label: "Chinese", enabled: true },
  { code: "pt", label: "Portuguese", enabled: true },
  { code: "it", label: "Italian", enabled: true },
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
  const playbackOptions = [0.75, 0.9, 1.0, 1.1, 1.25] as const;
  const [playbackRate, setPlaybackRate] = useState<typeof playbackOptions[number]>(
    1.0
  );
  const [showHistory, setShowHistory] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<TranscriptWord[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [currentOutputUrl, setCurrentOutputUrl] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(5);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pollingMessage, setPollingMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(0));
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const recordingStartTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const log = (...args: unknown[]) => console.info("[bowtie]", ...args);
  const inputMimeRef = useRef<string>("");
  const historyRef = useRef<HistoryEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const activeEntryIdRef = useRef<string | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const playbackIndex = useMemo(() => {
    const index = playbackOptions.indexOf(playbackRate);
    return index === -1 ? 2 : index;
  }, [playbackRate]);

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

  const removeHistoryEntry = (id: string) => {
    setHistory((prev) => {
      const entry = prev.find((item) => item.id === id);
      if (entry) {
        revokeEntry(entry);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const statusLabel = useMemo(() => {
    switch (phase) {
      case "listening":
        return "Listening… (tap to stop)";
      case "processing":
        return pollingMessage || "Translating…";
      case "transcribing":
        return "Getting transcript…";
      case "speaking":
        return "Speaking…";
      case "error":
        return "Try again.";
      default:
        return "Tap the bowtie to start.";
    }
  }, [phase, pollingMessage]);

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
      if (abortRef.current) {
        abortRef.current.abort();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (progressIntervalRef.current) {
        window.clearTimeout(progressIntervalRef.current);
      }
      playbackRef.current?.pause();
      playbackRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      historyRef.current.forEach(revokeEntry);
    };
  }, []);

  // Sync playback rate to audio element when slider changes
  useEffect(() => {
    if (playbackRef.current) {
      playbackRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels(new Array(16).fill(0));
  };

  const RECORDING_DURATION_MS = 5000;

  const startProgressTracking = () => {
    recordingStartTimeRef.current = Date.now();
    setRecordingProgress(0);
    setRecordingTimeLeft(5);

    const updateProgress = () => {
      if (!recordingStartTimeRef.current) return;
      const elapsed = Date.now() - recordingStartTimeRef.current;
      const progress = Math.min(elapsed / RECORDING_DURATION_MS, 1);
      const timeLeft = Math.max(0, Math.ceil((RECORDING_DURATION_MS - elapsed) / 1000));
      setRecordingProgress(progress);
      setRecordingTimeLeft(timeLeft);

      if (progress < 1) {
        progressIntervalRef.current = window.setTimeout(updateProgress, 50);
      }
    };

    updateProgress();
  };

  const stopProgressTracking = () => {
    if (progressIntervalRef.current) {
      window.clearTimeout(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    recordingStartTimeRef.current = null;
    setRecordingProgress(0);
    setRecordingTimeLeft(5);
  };

  const startAudioVisualization = (stream: MediaStream) => {
    const AudioContextImpl =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioContextImpl();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevels = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      // Sample 16 frequency bands for visualization
      const bands = 16;
      const levels: number[] = [];
      const bandSize = Math.floor(bufferLength / bands);

      for (let i = 0; i < bands; i++) {
        let sum = 0;
        for (let j = 0; j < bandSize; j++) {
          sum += dataArray[i * bandSize + j] || 0;
        }
        levels.push(sum / bandSize / 255); // Normalize to 0-1
      }

      setAudioLevels(levels);
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    };

    updateLevels();
  };

  const startRecording = async () => {
    setErrorMessage(null);
    log("Requesting microphone access.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Start audio visualization
      startAudioVisualization(stream);

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
        stopAudioVisualization();
        stopProgressTracking();

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
      startProgressTracking();
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
      setPhase("processing");
    }
  };

  const requestDubbing = async (audioBlob: Blob, entryId: string) => {
    setPhase("processing");
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      activeEntryIdRef.current = entryId;
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
        signal: controller.signal,
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
        await pollDubbingStatus(dubbingId, entryId, controller.signal);
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

      // Fetch transcript
      setPhase("transcribing");
      setTranscriptError(null);
      let transcript: TranscriptWord[] = [];
      try {
        const transcriptFormData = new FormData();
        transcriptFormData.append("audio", dubbedAudio, "dubbed.mp3");
        const transcriptResponse = await fetch("/api/transcribe", {
          method: "POST",
          body: transcriptFormData,
          signal: controller.signal,
        });
        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          transcript = transcriptData.words || [];
          updateHistoryEntry(entryId, { transcript });
          log("Transcript fetched.", { wordCount: transcript.length });
          if (transcript.length === 0) {
            setTranscriptError("No words detected in audio. Try speaking more clearly.");
          }
        } else {
          const errorData = await transcriptResponse.json().catch(() => null);
          const errorMsg = errorData?.error || "Failed to generate transcript.";
          log("Transcript fetch failed.", { error: errorMsg });
          setTranscriptError(errorMsg);
        }
      } catch (transcriptErr) {
        log("Transcript error, continuing without transcript.", { error: transcriptErr });
        setTranscriptError("Transcript service unavailable.");
      }

      // Trigger celebration
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);

      // Set up transcript view (don't auto-play due to browser autoplay policy)
      setCurrentOutputUrl(audioUrl);
      setCurrentTranscript(transcript);
      setCurrentWordIndex(-1);
      setPhase("idle"); // User can click Replay to hear
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        removeHistoryEntry(entryId);
        setPhase("idle");
        setErrorMessage(null);
        return;
      }
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

  const POLLING_TIMEOUT_MS = 120000; // 2 minutes
  const SLOW_WARNING_MS = 30000; // 30 seconds

  const pollDubbingStatus = async (
    dubbingId: string,
    entryId: string,
    signal?: AbortSignal
  ) => {
    const maxAttempts = 60; // Up to 2 minutes with 2s intervals
    const startTime = Date.now();
    setPollingMessage(null);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (signal?.aborted) {
        setPollingMessage(null);
        throw new DOMException("Aborted", "AbortError");
      }

      const elapsed = Date.now() - startTime;

      // Check for timeout
      if (elapsed >= POLLING_TIMEOUT_MS) {
        setPollingMessage(null);
        throw new Error("Dubbing timed out. Please try again.");
      }

      // Show warning after 30s
      if (elapsed >= SLOW_WARNING_MS) {
        setPollingMessage("Taking longer than expected…");
      }

      log("Polling dubbing status.", { attempt: attempt + 1, dubbingId, elapsed });
      const response = await fetch(
        `/api/dub/status?dubbing_id=${encodeURIComponent(
          dubbingId
        )}&target_lang=${encodeURIComponent(targetLang)}`
        ,
        { signal }
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

      // Fetch transcript
      setPhase("transcribing");
      setTranscriptError(null);
      let transcript: TranscriptWord[] = [];
      try {
        const transcriptFormData = new FormData();
        transcriptFormData.append("audio", dubbedAudio, "dubbed.mp3");
        const transcriptResponse = await fetch("/api/transcribe", {
          method: "POST",
          body: transcriptFormData,
          signal,
        });
        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          transcript = transcriptData.words || [];
          updateHistoryEntry(entryId, { transcript });
          log("Transcript fetched from poll.", { wordCount: transcript.length });
          if (transcript.length === 0) {
            setTranscriptError("No words detected in audio. Try speaking more clearly.");
          }
        } else {
          const errorData = await transcriptResponse.json().catch(() => null);
          setTranscriptError(errorData?.error || "Failed to generate transcript.");
        }
      } catch (transcriptErr) {
        log("Transcript error from poll, continuing without transcript.");
        setTranscriptError("Transcript service unavailable.");
      }

      // Trigger celebration
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);

      // Set up transcript view (don't auto-play due to browser autoplay policy)
      setPollingMessage(null);
      setCurrentOutputUrl(audioUrl);
      setCurrentTranscript(transcript);
      setCurrentWordIndex(-1);
      setPhase("idle"); // User can click Replay to hear
      return;
    }

    setPollingMessage(null);
    throw new Error("Dubbing timed out. Please try again.");
  };

  // Extract transcript seeking into reusable function
  const seekToWord = (word: TranscriptWord, wordIndex: number) => {
    if (playbackRef.current) {
      playbackRef.current.currentTime = word.start;
      setCurrentWordIndex(wordIndex);
      setPhase("speaking");
      playbackRef.current.play().catch(console.error);
    } else if (currentOutputUrl) {
      // Recreate audio and seek to word
      const audio = new Audio(currentOutputUrl);
      audio.playbackRate = playbackRate;
      playbackRef.current = audio;
      audio.currentTime = word.start;
      setCurrentWordIndex(wordIndex);
      setPhase("speaking");

      audio.ontimeupdate = () => {
        if (currentTranscript.length === 0) return;
        const time = audio.currentTime;
        const idx = currentTranscript.findIndex(
          (w) => time >= w.start && time < w.end
        );
        if (idx !== -1) setCurrentWordIndex(idx);
      };

      audio.onended = () => {
        setPhase("idle");
        setCurrentWordIndex(-1);
      };

      audio.play().catch(console.error);
    }
  };

  const playWithTranscript = (url: string, transcript: TranscriptWord[]) => {
    // Stop any existing playback
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }

    const audio = new Audio(url);
    playbackRef.current = audio;
    audio.playbackRate = playbackRate;
    setCurrentOutputUrl(url);
    setCurrentTranscript(transcript);
    setCurrentWordIndex(-1);
    setPhase("speaking");

    // Set up transcript sync
    audio.ontimeupdate = () => {
      if (transcript.length === 0) return;
      const currentTime = audio.currentTime;
      const wordIndex = transcript.findIndex(
        (word) => currentTime >= word.start && currentTime < word.end
      );
      if (wordIndex !== -1) {
        setCurrentWordIndex(wordIndex);
      }
    };

    audio.onended = () => {
      setPhase("idle");
      setCurrentWordIndex(-1);
      // Keep playbackRef and currentOutputUrl so Replay works
      log("Playback finished.");
    };

    audio.play().catch((err) => {
      console.error(err);
      setErrorMessage("Audio playback failed on this browser.");
      setPhase("error");
    });
  };

  const replayCurrentAudio = () => {
    if (!currentOutputUrl) return;

    // Stop any existing playback first
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }

    // Always create fresh audio element to avoid browser quirks
    playWithTranscript(currentOutputUrl, currentTranscript);
  };

  const clearHistory = () => {
    // Stop any playing audio first
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }
    setCurrentTranscript([]);
    setCurrentWordIndex(-1);
    setCurrentOutputUrl(null);
    setTranscriptError(null);
    setPhase("idle");

    setHistory((prev) => {
      prev.forEach(revokeEntry);
      return [];
    });
    setShowClearConfirm(false);
  };

  const handleBowtieClick = () => {
    if (phase === "idle" || phase === "error") {
      void startRecording();
      return;
    }
    if (phase === "listening") {
      stopRecording();
      return;
    }
    if (phase === "speaking") {
      // Pause playback
      if (playbackRef.current) {
        playbackRef.current.pause();
      }
      setPhase("idle");
      log("Playback paused by user.");
      return;
    }
    if (phase === "processing") {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (activeEntryIdRef.current) {
        removeHistoryEntry(activeEntryIdRef.current);
        activeEntryIdRef.current = null;
      }
      playbackRef.current?.pause();
      playbackRef.current = null;
      setErrorMessage(null);
      setPhase("idle");
    }
  };

  const isPlaybackPhase = phase === "speaking" || phase === "transcribing";
  // Show transcript view if: playing, have transcript, OR have audio ready to play
  const showTranscriptView = isPlaybackPhase || currentTranscript.length > 0 || currentOutputUrl !== null;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full glow-orb" />
      <div className="pointer-events-none absolute bottom-10 right-0 h-96 w-96 rounded-full glow-orb" />
      <div className="pointer-events-none absolute inset-0 comic-dots" />

      {/* History Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] transform bg-white/98 shadow-[4px_0_30px_rgba(26,58,110,0.15)] transition-transform duration-300 ${
          showHistory ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-blue-100 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-900">
              History
            </h2>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="rounded-full p-2 text-blue-600 hover:bg-blue-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {history.length === 0 ? (
              <p className="text-center text-sm text-blue-600">
                No recordings yet.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-xl border p-3 ${
                      entry.status === "error"
                        ? "border-red-200 bg-red-50/50"
                        : entry.status === "processing"
                        ? "border-yellow-200 bg-yellow-50/50"
                        : "border-blue-100 bg-blue-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {/* Status indicator */}
                        {entry.status === "processing" && (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Processing
                          </span>
                        )}
                        {entry.status === "ready" && (
                          <span className="flex items-center gap-1 text-green-600">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Ready
                          </span>
                        )}
                        {entry.status === "error" && (
                          <span className="flex items-center gap-1 text-red-600">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Failed
                          </span>
                        )}
                        <span className="text-blue-600 font-medium">
                          {LANGUAGES.find((l) => l.code === entry.targetLang)?.label}
                        </span>
                      </div>
                      <span className="text-blue-500">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                    </div>
                    {/* Error message */}
                    {entry.status === "error" && entry.errorMessage && (
                      <p className="mt-2 text-xs text-red-600 bg-red-100 rounded px-2 py-1">
                        {entry.errorMessage}
                      </p>
                    )}
                    {entry.transcript && entry.transcript.length > 0 && (
                      <p className="mt-2 line-clamp-2 text-sm text-blue-800">
                        {entry.transcript.map((w) => w.text).join("")}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Play input audio (no transcript sync)
                          const audio = new Audio(entry.inputUrl);
                          audio.playbackRate = playbackRate;
                          audio.play().catch(console.error);
                          setShowHistory(false);
                        }}
                        className="flex-1 rounded-full border border-blue-200 bg-white py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Input
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (entry.outputUrl) {
                            playWithTranscript(entry.outputUrl, entry.transcript || []);
                          }
                          setShowHistory(false);
                        }}
                        disabled={!entry.outputUrl}
                        className="flex-1 rounded-full border border-blue-200 bg-white py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Output
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {history.length > 0 && (
            <div className="border-t border-blue-100 p-4">
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full rounded-full border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Backdrop */}
      {showHistory && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setShowHistory(false)}
        />
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowClearConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-red-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-blue-900">Clear All Recordings?</h3>
            <p className="mt-2 text-sm text-blue-600">
              This will delete all {history.length} recording{history.length !== 1 ? "s" : ""}. This cannot be undone.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-full border border-blue-200 bg-white py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={clearHistory}
                className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600"
              >
                Delete All
              </button>
            </div>
          </div>
        </>
      )}

      {/* Header - Always visible */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 md:px-6 md:py-4">
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="hidden sm:inline">History</span>
          {history.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              {history.length}
            </span>
          )}
        </button>

        {/* Mini bowtie in header during playback */}
        {showTranscriptView && (
          <button
            type="button"
            onClick={handleBowtieClick}
            className="flex items-center gap-2 transition-all hover:opacity-80"
            title={phase === "speaking" ? "Click to pause" : ""}
          >
            <img
              src="/images/bow.png"
              alt="Bowtie"
              className={`h-10 w-auto ${phase === "speaking" ? "animate-pulse" : ""}`}
            />
            <span className="text-sm font-medium text-blue-700">
              {phase === "speaking" ? "Playing (tap to pause)" : phase === "transcribing" ? "Loading..." : "Ready"}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <select
            className="rounded-full border border-blue-200 bg-white/90 px-3 py-2 text-sm font-medium text-blue-700 shadow-sm focus:outline-none"
            value={targetLang}
            onChange={(event) => setTargetLang(event.target.value)}
          >
            {LANGUAGES.filter((l) => l.enabled).map((language) => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Content - Phase Adaptive */}
      <main className="relative flex flex-1 flex-col">
        {/* IDLE / RECORDING / PROCESSING Layout */}
        {!showTranscriptView && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24 text-center">
            {/* Title - only in idle */}
            {phase === "idle" && (
              <div className="space-y-2">
                <h1 className="font-display text-3xl leading-tight text-blue-900 md:text-4xl">
                  There is always only one truth!
                </h1>
                <p className="text-base text-blue-700">
                  Tap the bowtie to speak in a new language
                </p>
              </div>
            )}

            {/* Bowtie - Large */}
            <div
              className={`bowtie-wrap ${
                phase === "listening" ? "bowtie-listening" : ""
              } ${phase === "processing" ? "bowtie-processing" : ""}`}
            >
              {/* Celebration Sparkles */}
              {showCelebration && (
                <div className="celebration-container absolute inset-0 pointer-events-none overflow-visible">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="sparkle absolute"
                      style={{
                        left: `${50 + 40 * Math.cos((i * 30 * Math.PI) / 180)}%`,
                        top: `${50 + 40 * Math.sin((i * 30 * Math.PI) / 180)}%`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Progress Ring */}
              {phase === "listening" && (
                <svg className="progress-ring absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(47, 93, 255, 0.15)" strokeWidth="3" />
                  <circle
                    cx="50"
                    cy="50"
                    r="48"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - recordingProgress)}
                    className="transition-all duration-100"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffd34d" />
                      <stop offset="50%" stopColor="#ff3b5c" />
                      <stop offset="100%" stopColor="#2f5dff" />
                    </linearGradient>
                  </defs>
                </svg>
              )}

              <button
                type="button"
                onClick={handleBowtieClick}
                className="relative grid h-full w-full place-items-center bg-transparent p-0 transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200"
                aria-pressed={phase === "listening"}
              >
                <span className="sr-only">Activate bowtie microphone</span>
                <img src="/images/bow.png" alt="Detective Conan bowtie" className="bowtie-image" />
              </button>

              {/* Audio Waveform */}
              {phase === "listening" && (
                <div className="audio-waveform absolute -bottom-10 left-1/2 flex -translate-x-1/2 items-end gap-1">
                  {audioLevels.map((level, index) => (
                    <div
                      key={index}
                      className="waveform-bar w-2 rounded-full bg-gradient-to-t from-blue-500 to-yellow-400 transition-all duration-75"
                      style={{ height: `${Math.max(4, level * 40)}px`, opacity: 0.6 + level * 0.4 }}
                    />
                  ))}
                </div>
              )}

            </div>

            {/* Status */}
            <div className="speech-bubble relative mt-4 rounded-2xl border-2 border-blue-200 bg-white px-6 py-3 shadow-md">
              <p className="text-lg font-semibold text-blue-900">{statusLabel}</p>
              {/* Recording Countdown Timer - inside speech bubble */}
              {phase === "listening" && (
                <p className={`mt-1 text-center ${recordingTimeLeft <= 2 ? "text-red-500" : "text-blue-600"}`}>
                  <span className={`text-xl font-bold tabular-nums ${recordingTimeLeft <= 2 ? "animate-pulse" : ""}`}>
                    {5 - recordingTimeLeft}s
                  </span>
                  <span className="text-sm"> / 5s</span>
                </p>
              )}
              <div className="absolute -bottom-2 left-1/2 h-0 w-0 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white" />
              <div className="absolute -bottom-[11px] left-1/2 -z-10 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-blue-200" />
            </div>

            {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
          </div>
        )}

        {/* PLAYBACK Layout - Transcript Dominates */}
        {showTranscriptView && (
          <div className="flex flex-1 flex-col">
            {/* Transcript Area - Takes most of the screen */}
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
              <div className="mx-auto max-w-2xl rounded-2xl border-2 border-blue-100 bg-white/95 p-4 shadow-lg md:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                    Transcript
                  </h3>
                  {phase === "transcribing" && (
                    <span className="text-xs text-blue-500 animate-pulse">Loading...</span>
                  )}
                </div>
                {currentTranscript.length > 0 ? (
                  <div className="transcript-container text-xl leading-relaxed text-blue-900 md:text-2xl">
                    {currentTranscript.map((word, index) => (
                      <span
                        key={`${word.start}-${index}`}
                        onClick={() => seekToWord(word, index)}
                        className={`transcript-word cursor-pointer rounded px-0.5 transition-all duration-150 hover:bg-blue-100 ${
                          index === currentWordIndex
                            ? "bg-yellow-300 text-blue-900 font-bold"
                            : index < currentWordIndex
                            ? "text-blue-400"
                            : "text-blue-800"
                        }`}
                      >
                        {word.text}
                      </span>
                    ))}
                  </div>
                ) : phase === "transcribing" ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
                  </div>
                ) : currentOutputUrl ? (
                  <div className="py-8 text-center">
                    <p className="text-blue-600 font-medium">Audio ready! Click Play to listen.</p>
                    {transcriptError ? (
                      <p className="mt-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 inline-block">
                        {transcriptError}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-blue-400">(Transcript unavailable)</p>
                    )}
                  </div>
                ) : (
                  <p className="py-8 text-center text-blue-500">Transcript will appear here...</p>
                )}
              </div>
            </div>

            {/* Bottom Controls - Thumb Zone */}
            <div className="border-t border-blue-100 bg-white/95 px-4 py-4 backdrop-blur-sm md:px-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-3">
                {/* Playback Speed */}
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xs uppercase tracking-wider text-blue-600">Speed</span>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={playbackIndex}
                    onChange={(event) => {
                      const next = playbackOptions[Number(event.target.value)] ?? 1.0;
                      setPlaybackRate(next);
                    }}
                    className="h-2 w-28 accent-yellow-400"
                  />
                  <span className="min-w-[3rem] rounded-full bg-blue-100 px-2 py-1 text-center text-xs font-semibold text-blue-700">
                    {playbackRate.toFixed(2)}x
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Stop any playing audio
                      if (playbackRef.current) {
                        playbackRef.current.pause();
                        playbackRef.current = null;
                      }
                      setCurrentTranscript([]);
                      setCurrentWordIndex(-1);
                      setCurrentOutputUrl(null);
                      setTranscriptError(null);
                      setPhase("idle");
                    }}
                    className="flex-1 rounded-full border-2 border-blue-200 bg-white py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                  >
                    New Recording
                  </button>
                  <button
                    type="button"
                    onClick={replayCurrentAudio}
                    disabled={!currentOutputUrl || phase === "speaking"}
                    className="flex-1 rounded-full bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {phase === "speaking" ? "Playing..." : "Play"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
