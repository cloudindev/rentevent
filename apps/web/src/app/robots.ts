import type { MetadataRoute } from "next";

const base = process.env.APP_URL ?? "https://rentevent.es";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/m/", "/api/", "/acceso/", "/espacios", "/invitacion/", "/dev/", "/p/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
