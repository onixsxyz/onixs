import { NextResponse, type NextRequest } from "next/server";
import { BRAND, DOMAIN_LIVE } from "@/config/brand";

/*
 * Keeps *.vercel.app from competing with the real domain in search results:
 * the production deployment's vercel.app host redirects to the domain, and
 * preview deployments are marked noindex. Until DOMAIN_LIVE is set, vercel.app is served noindex without redirecting.
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (!host.endsWith(".vercel.app")) return NextResponse.next();
  if (DOMAIN_LIVE && process.env.VERCEL_ENV === "production") {
    // Host fixed to the brand domain; the path is assigned, never parsed as a URL, so "//other.host" stays a path.
    const url = new URL(BRAND.url);
    url.pathname = request.nextUrl.pathname;
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url, 308);
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
