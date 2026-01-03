import { NextResponse } from "next/server";
import { createHash } from "crypto";

const AUTH_COOKIE = "bowtie_auth";

export async function POST(request: Request) {
  const expectedPassword = process.env.APP_PASSWORD;
  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Missing APP_PASSWORD." },
      { status: 500 }
    );
  }

  let password = "";
  try {
    const payload = await request.json();
    password = (payload?.password ?? "").toString();
  } catch {
    password = "";
  }

  if (!password || password !== expectedPassword) {
    return NextResponse.json(
      { error: "Invalid password." },
      { status: 401 }
    );
  }

  const hash = createHash("sha256").update(expectedPassword).digest("hex");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, hash, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
