import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const ROOT = (process.env.ROOT_DOMAIN ?? "localhost:3000").toLowerCase();
const RESERVED = new Set(["www", "app", "api", "admin", "static", "mail"]);

/** `acme.rentevent.es` → "acme"; root domain, previews and IPs → null. */
export function tenantFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase();
  const root = ROOT.split(":")[0]!;
  const hostname = h.split(":")[0]!;
  if (hostname === root || !hostname.endsWith(`.${root}`)) return null;
  const sub = hostname.slice(0, -(root.length + 1));
  if (!sub || sub.includes(".") || RESERVED.has(sub)) return null;
  return sub;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const slug = tenantFromHost(request.headers.get("host"));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-slug");
  if (slug) requestHeaders.set("x-tenant-slug", slug);

  // Company subdomain root → company login or app
  if (slug && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = getSessionCookie(request, { cookiePrefix: "rv" }) ? "/app/inicio" : `/acceso/${slug}`;
    return NextResponse.redirect(url);
  }

  const isPrivate = pathname.startsWith("/app") || pathname.startsWith("/m/") || pathname === "/m" || pathname.startsWith("/espacios") || pathname.startsWith("/registro/empresa");
  if (isPrivate && !getSessionCookie(request, { cookiePrefix: "rv" })) {
    const url = request.nextUrl.clone();
    url.pathname = slug ? `/acceso/${slug}` : "/acceso";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|icons/|images/|sw.js|manifest.webmanifest|robots.txt|sitemap.xml).*)"],
};
