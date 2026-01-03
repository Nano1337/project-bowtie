import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "bowtie_auth";

const hashPassword = async (password: string) => {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isPublicPath = (pathname: string) => {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/login" ||
    pathname === "/api/auth"
  );
};

export async function middleware(request: NextRequest) {
  const expectedPassword = process.env.APP_PASSWORD;
  if (!expectedPassword) {
    return new NextResponse("Server is missing APP_PASSWORD.", { status: 500 });
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const expectedHash = await hashPassword(expectedPassword);
  const cookieValue = request.cookies.get(AUTH_COOKIE)?.value;

  if (cookieValue !== expectedHash) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
