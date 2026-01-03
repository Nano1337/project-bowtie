export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
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
    return Response.json(
      { error: payload?.detail || "ElevenLabs dubbing request failed." },
      { status: 500 }
    );
  }

  const { dubbing_id: dubbingId } = (await createResponse.json()) as {
    dubbing_id?: string;
  };

  if (!dubbingId) {
    return Response.json(
      { error: "ElevenLabs did not return a dubbing id." },
      { status: 500 }
    );
  }

  let status = "processing";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(1500);
    const statusResponse = await fetch(
      `${ELEVENLABS_BASE_URL}/dubbing/${dubbingId}`,
      {
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!statusResponse.ok) {
      continue;
    }

    const statusPayload = (await statusResponse.json()) as {
      status?: string;
    };
    status = statusPayload.status ?? status;
    if (status === "dubbed" || status === "completed") {
      break;
    }
    if (status === "failed") {
      return Response.json(
        { error: "ElevenLabs dubbing failed." },
        { status: 500 }
      );
    }
  }

  const audioResponse = await fetch(
    `${ELEVENLABS_BASE_URL}/dubbing/${dubbingId}/audio/${targetLang}`,
    {
      headers: {
        "xi-api-key": apiKey,
      },
    }
  );

  if (!audioResponse.ok || !audioResponse.body) {
    return Response.json(
      { error: "Dubbing audio not ready yet." },
      { status: 504 }
    );
  }

  return new Response(audioResponse.body, {
    status: 200,
    headers: {
      "Content-Type":
        audioResponse.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
