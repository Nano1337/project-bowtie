export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const log = (message: string, meta?: Record<string, unknown>) => {
    if (meta) {
      console.info(`[dub-status:${requestId}] ${message}`, meta);
    } else {
      console.info(`[dub-status:${requestId}] ${message}`);
    }
  };

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Missing ELEVENLABS_API_KEY." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const dubbingId = searchParams.get("dubbing_id");
  const targetLang = searchParams.get("target_lang") || "en";

  if (!dubbingId) {
    return Response.json(
      { error: "Missing dubbing_id." },
      { status: 400 }
    );
  }

  log("Status check requested.", { dubbingId, targetLang });

  const statusResponse = await fetch(
    `${ELEVENLABS_BASE_URL}/dubbing/${dubbingId}`,
    {
      headers: {
        "xi-api-key": apiKey,
      },
    }
  );

  if (!statusResponse.ok) {
    log("Status fetch failed.", { status: statusResponse.status });
    return Response.json(
      { error: "Failed to fetch dubbing status." },
      { status: 502 }
    );
  }

  const statusPayload = (await statusResponse.json()) as {
    status?: string;
  };
  const status = statusPayload.status ?? "unknown";
  log("Status response.", { status });

  if (status === "failed") {
    return Response.json(
      { error: "ElevenLabs dubbing failed." },
      { status: 500 }
    );
  }

  if (status !== "dubbed") {
    return Response.json(
      { status, dubbing_id: dubbingId, message: "Dubbing is still processing." },
      { status: 202 }
    );
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
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
    await sleep(1200);
  }

  return Response.json(
    { error: "Dubbing audio not ready yet." },
    { status: 504 }
  );
}
