import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
