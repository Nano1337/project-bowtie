export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";
const STATUS_POLL_DELAY_MS = 2000;
const STATUS_POLL_ATTEMPTS = 25;
const AUDIO_RETRY_DELAY_MS = 1200;
const AUDIO_RETRY_ATTEMPTS = 8;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const log = (message: string, meta?: Record<string, unknown>) => {
    if (meta) {
      console.info(`[dub:${requestId}] ${message}`, meta);
    } else {
      console.info(`[dub:${requestId}] ${message}`);
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
  const targetLang = (formData.get("target_lang") || "en").toString();

  if (!audio || !(audio instanceof File)) {
    return Response.json(
      { error: "Audio file is required." },
      { status: 400 }
    );
  }

  log("Request received.", {
    targetLang,
    audioSize: audio.size,
    audioType: audio.type,
  });

  const elevenForm = new FormData();
  elevenForm.append("file", audio, "bowtie.webm");
  elevenForm.append("name", `Bowtie-${Date.now()}`);
  elevenForm.append("source_lang", "auto");
  elevenForm.append("target_lang", targetLang);
  elevenForm.append("mode", "automatic");

  const createResponse = await fetch(`${ELEVENLABS_BASE_URL}/dubbing`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: elevenForm,
  });

  if (!createResponse.ok) {
    const payload = await createResponse.json().catch(() => null);
    log("Dubbing creation failed.", {
      status: createResponse.status,
      detail: payload?.detail,
    });
    return Response.json(
      { error: payload?.detail || "ElevenLabs dubbing request failed." },
      { status: 500 }
    );
  }

  const { dubbing_id: dubbingId } = (await createResponse.json()) as {
    dubbing_id?: string;
  };

  if (!dubbingId) {
    log("Missing dubbing id in response.");
    return Response.json(
      { error: "ElevenLabs did not return a dubbing id." },
      { status: 500 }
    );
  }

  log("Dubbing job created.", { dubbingId });

  let status = "dubbing";
  for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt += 1) {
    await sleep(STATUS_POLL_DELAY_MS);
    const statusResponse = await fetch(
      `${ELEVENLABS_BASE_URL}/dubbing/${dubbingId}`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!statusResponse.ok) {
      log("Status poll failed.", {
        attempt: attempt + 1,
        status: statusResponse.status,
      });
      continue;
    }

    const statusPayload = (await statusResponse.json()) as {
      status?: string;
    };
    status = statusPayload.status ?? status;
    log("Status poll.", { attempt: attempt + 1, status });
    if (status === "dubbed") {
      break;
    }
    if (status === "failed") {
      log("Dubbing failed.");
      return Response.json(
        { error: "ElevenLabs dubbing failed." },
        { status: 500 }
      );
    }
  }

  if (status !== "dubbed") {
    log("Dubbing still processing after polling window.", { status });
    return Response.json(
      { error: "Dubbing is still processing." },
      { status: 504 }
    );
  }

  for (let attempt = 0; attempt < AUDIO_RETRY_ATTEMPTS; attempt += 1) {
    const audioResponse = await fetch(
      `${ELEVENLABS_BASE_URL}/dubbing/${dubbingId}/audio/${targetLang}`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (audioResponse.ok && audioResponse.body) {
      log("Audio ready.", { attempt: attempt + 1 });
      return new Response(audioResponse.body, {
        status: 200,
        headers: {
          "Content-Type":
            audioResponse.headers.get("content-type") || "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    log("Audio not ready yet.", {
      attempt: attempt + 1,
      status: audioResponse.status,
    });
    await sleep(AUDIO_RETRY_DELAY_MS);
  }

  log("Audio fetch exhausted retries.");
  return Response.json(
    { error: "Dubbing audio not ready yet." },
    { status: 504 }
  );
}
