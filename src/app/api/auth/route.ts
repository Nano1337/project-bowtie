import { NextResponse } from "next/server";

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

  return NextResponse.json({ ok: true });
}
