export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};

type ElevenLabsWord = {
  text: string;
  start: number;
  end: number;
  type: string;
  speaker_id: string;
};

type ElevenLabsSentence = {
  text: string;
  start: number;
  end: number;
  speaker_id: string;
};

type ElevenLabsTranscriptResponse = {
  language_code: string;
  language_probability: number;
  text: string;
  words?: ElevenLabsWord[];
  sentences?: ElevenLabsSentence[];
};

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const log = (message: string, meta?: Record<string, unknown>) => {
    if (meta) {
      console.info(`[transcribe:${requestId}] ${message}`, meta);
    } else {
      console.info(`[transcribe:${requestId}] ${message}`);
    }
  };

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Missing ELEVENLABS_API_KEY." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!audio || !(audio instanceof File)) {
    return Response.json(
      { error: "Audio file is required." },
      { status: 400 }
    );
  }

  log("Transcription request received.", {
    audioSize: audio.size,
    audioType: audio.type,
  });

  const elevenForm = new FormData();
  elevenForm.append("file", audio, "audio.mp3");
  elevenForm.append("model_id", "scribe_v1");
  elevenForm.append("timestamps_granularity", "word");
  elevenForm.append("tag_audio_events", "false");

  const transcribeResponse = await fetch(
    `${ELEVENLABS_BASE_URL}/speech-to-text`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: elevenForm,
    }
  );

  if (!transcribeResponse.ok) {
    const payload = await transcribeResponse.json().catch(() => null);
    log("Transcription failed.", {
      status: transcribeResponse.status,
      detail: payload?.detail,
    });
    return Response.json(
      { error: payload?.detail || "ElevenLabs transcription failed." },
      { status: 500 }
    );
  }

  const result = (await transcribeResponse.json()) as ElevenLabsTranscriptResponse;

  log("Transcription complete.", {
    languageCode: result.language_code,
    wordCount: result.words?.length ?? 0,
    textLength: result.text?.length ?? 0,
    rawResult: JSON.stringify(result).slice(0, 500),
  });

  // Handle case where words might be nested or in different format
  let words: TranscriptWord[] = [];

  if (result.words && Array.isArray(result.words)) {
    words = result.words.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
    }));
  } else if (result.text) {
    // Fallback: if no word-level timestamps, create single "word" from full text
    log("No word-level timestamps, using full text as fallback");
    words = [{ text: result.text, start: 0, end: 1 }];
  }

  return Response.json({
    text: result.text || "",
    words,
    language: result.language_code || "unknown",
  });
}
