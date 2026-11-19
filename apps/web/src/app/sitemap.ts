import type { MetadataRoute } from "next";
import { MODULES, SOLUTIONS } from "@/components/marketing/content";
import { LEGAL } from "@/components/marketing/legal";
import { POSTS } from "@/content/posts";

const base = process.env.APP_URL ?? "https://rentevent.es";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority = 0.7, lastModified: Date = now): MetadataRoute.Sitemap[number] => ({ url: `${base}${path}`, lastModified, changeFrequency: "monthly", priority });
  return [
    page("/", 1),
    page("/precios", 0.9),
    page("/clientes", 0.6),
    page("/recursos", 0.7),
    page("/contacto", 0.8),
    page("/registro", 0.8),
    ...MODULES.map((m) => page(`/producto/${m.slug}`, 0.8)),
    ...SOLUTIONS.map((s) => page(`/soluciones/${s.slug}`, 0.7)),
    ...POSTS.map((p) => page(`/recursos/blog/${p.slug}`, 0.6, new Date(p.date))),
    ...LEGAL.map((l) => page(`/legal/${l.slug}`, 0.2, new Date(l.updated))),
  ];
}
