import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const UNAUTHORIZED_RESPONSE = new NextResponse("Authentication required.", {
  status: 401,
  headers: {
    "WWW-Authenticate": 'Basic realm="Bowtie Dubbing Lab"',
  },
});

export function middleware(request: NextRequest) {
  const expectedPassword = process.env.APP_PASSWORD;
  if (!expectedPassword) {
    return new NextResponse("Server is missing APP_PASSWORD.", { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return UNAUTHORIZED_RESPONSE;
  }

  const encoded = authorization.split(" ")[1] ?? "";
  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return UNAUTHORIZED_RESPONSE;
  }

  const [, password] = decoded.split(":");
  if (password !== expectedPassword) {
    return UNAUTHORIZED_RESPONSE;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
