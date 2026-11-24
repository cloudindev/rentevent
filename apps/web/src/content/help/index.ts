/**
 * Help centre registry: order and grouping of the areas. Each area's content
 * lives in ./areas/<slug>.ts and is written from the real back-office UI.
 */
import type { HelpArea, HelpArticle } from "./types";
import { area as almacen } from "./areas/almacen";
import { area as analytics } from "./areas/analytics";
import { area as asistente } from "./areas/asistente";
import { area as carpas } from "./areas/carpas";
import { area as comunicacion } from "./areas/comunicacion";
import { area as configuracion } from "./areas/configuracion";
import { area as contactos } from "./areas/contactos";
import { area as emails } from "./areas/emails";
import { area as espacios } from "./areas/espacios";
import { area as finanzas } from "./areas/finanzas";
import { area as inicio } from "./areas/inicio";
import { area as inventario } from "./areas/inventario";
import { area as mantenimiento } from "./areas/mantenimiento";
import { area as pedidos } from "./areas/pedidos";
import { area as personal } from "./areas/personal";
import { area as primerosPasos } from "./areas/primeros-pasos";
import { area as proyectos } from "./areas/proyectos";
import { area as subalquileres } from "./areas/subalquileres";
import { area as transporte } from "./areas/transporte";
import { area as workflows } from "./areas/workflows";

export type { HelpArea, HelpArticle, HelpStep } from "./types";

export const HELP_GROUPS: { title: string; areas: HelpArea[] }[] = [
  { title: "Empezar", areas: [primerosPasos, inicio] },
  { title: "Ventas y clientes", areas: [pedidos, proyectos, contactos, subalquileres] },
  { title: "Carpas y material", areas: [carpas, inventario, almacen, mantenimiento, transporte, espacios] },
  { title: "Equipo", areas: [personal, comunicacion, emails] },
  { title: "Finanzas", areas: [finanzas] },
  { title: "IA y automatización", areas: [asistente, workflows, analytics] },
  { title: "Administración", areas: [configuracion] },
];

export const HELP_AREAS: HelpArea[] = HELP_GROUPS.flatMap((g) => g.areas);

export const findArea = (slug: string) => HELP_AREAS.find((a) => a.slug === slug) ?? null;

export function findArticle(areaSlug: string, articleSlug: string): { area: HelpArea; article: HelpArticle; index: number } | null {
  const area = findArea(areaSlug);
  const index = area?.articles.findIndex((a) => a.slug === articleSlug) ?? -1;
  return area && index >= 0 ? { area, article: area.articles[index]!, index } : null;
}

/** Previous/next article across the whole centre, for reading it as a course. */
export function neighbours(areaSlug: string, articleSlug: string) {
  const flat = HELP_AREAS.flatMap((a) => a.articles.map((x) => ({ area: a, article: x })));
  const i = flat.findIndex((x) => x.area.slug === areaSlug && x.article.slug === articleSlug);
  return { prev: i > 0 ? flat[i - 1]! : null, next: i >= 0 && i < flat.length - 1 ? flat[i + 1]! : null };
}

/** Lightweight index for the client-side search. */
export function searchIndex() {
  return HELP_AREAS.flatMap((a) => [
    { href: `/ayuda/${a.slug}`, title: a.title, area: "Área", text: [a.summary, ...a.overview, ...(a.concepts ?? []).map((c) => `${c.term} ${c.definition}`)].join(" ") },
    ...a.articles.map((x) => ({
      href: `/ayuda/${a.slug}/${x.slug}`,
      title: x.title,
      area: a.title,
      text: [x.summary, x.intro ?? "", ...x.steps.map((s) => `${s.title} ${s.text} ${s.tip ?? ""}`), ...(x.notes ?? [])].join(" "),
    })),
  ]);
}
export type HelpSearchEntry = ReturnType<typeof searchIndex>[number];
