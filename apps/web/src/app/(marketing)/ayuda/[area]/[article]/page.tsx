import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, Info, MapPin, ShieldCheck } from "lucide-react";
import { findArticle, HELP_AREAS, neighbours } from "@/content/help";
import { Rich, plain } from "@/components/help/rich";
import { HelpSteps } from "@/components/help/steps";
import { NAV, SETTINGS_ITEM } from "@/components/app/nav";

export const dynamicParams = false;
export const generateStaticParams = () => HELP_AREAS.flatMap((a) => a.articles.map((x) => ({ area: a.slug, article: x.slug })));

export async function generateMetadata({ params }: { params: Promise<{ area: string; article: string }> }): Promise<Metadata> {
  const { area, article } = await params;
  const f = findArticle(area, article);
  return f ? { title: `${f.article.title} · ${f.area.title}`, description: plain(f.article.summary), alternates: { canonical: `/ayuda/${area}/${article}` } } : {};
}

const SEGMENTS: Record<string, string> = {
  m: "App móvil", almacen: "Almacén", configuracion: "Configuración", comunicacion: "Comunicación", tesoreria: "Tesorería", ocupacion: "Ocupación de cerchas",
  asistente: "Asistente", retornos: "Retornos", albaranes: "Albaranes", recuentos: "Recuentos", certificado: "Certificado", unidades: "Unidades", etiquetas: "Etiquetas", kits: "Kits",
  importar: "Importar", impuestos: "Impuestos y series", usuarios: "Usuarios y roles", suscripcion: "Suscripción", seguridad: "Seguridad y datos", api: "API y webhooks",
  integraciones: "Integraciones", plantillas: "Plantillas", tarifas: "Tarifas", fichajes: "Fichajes", parte: "Partes", tablero: "Tablero", nuevo: "Nuevo", visor: "Visor 3D",
  limpieza: "Limpieza de lonas", revisiones: "Revisiones", historial: "Historial", perfil: "Perfil", onboarding: "Asistente inicial", escanear: "Escanear", fichar: "Fichar",
  turno: "Turno", registro: "Registro", empresa: "Empresa", acceso: "Acceso", recuperar: "Recuperar contraseña", espacios: "Espacios", invitacion: "Invitación", export: "Exportar",
};
const NAV_LABEL = new Map([...NAV.flatMap((g) => g.items), SETTINGS_ITEM].map((i) => [i.href.replace("/app/", ""), i.label]));

/** "/app/almacen/retornos" → "Almacén › Retornos" for the "where" hint (dynamic segments dropped). */
const where = (path: string) => {
  const segs = path.split("?")[0]!.replace(/^\/app\/?/, "").split("/").filter((x) => x && !x.startsWith("["));
  return segs.map((x, i) => (i === 0 && NAV_LABEL.get(x)) || SEGMENTS[x] || x.charAt(0).toUpperCase() + x.slice(1).replace(/-/g, " ")).join(" › ") || "Inicio";
};

export default async function HelpArticlePage({ params }: { params: Promise<{ area: string; article: string }> }) {
  const { area: a, article: s } = await params;
  const f = findArticle(a, s);
  if (!f) notFound();
  const { area, article } = f;
  const { prev, next } = neighbours(a, s);
  const openable = article.path && !article.path.includes("[");
  return (
    <article>
      <nav aria-label="Migas de pan" className="text-sm text-muted-foreground">
        <Link href="/ayuda" className="hover:text-foreground">
          Ayuda
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/ayuda/${area.slug}`} className="hover:text-foreground">
          {area.title}
        </Link>
      </nav>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{article.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        <Rich text={article.summary} />
      </p>

      {(article.path || article.roles) && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          {article.path && (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
              <MapPin className="size-3.5 text-brand-600" aria-hidden /> {where(article.path)}
            </span>
          )}
          {article.roles && (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
              <ShieldCheck className="size-3.5 text-brand-600" aria-hidden /> {article.roles}
            </span>
          )}
          {openable && (
            <a href={article.path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 font-medium text-background hover:opacity-90">
              Abrir en Rentevent <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      )}

      {article.intro && (
        <p className="mt-6 text-[15px] leading-relaxed text-foreground/85">
          <Rich text={article.intro} />
        </p>
      )}

      <HelpSteps steps={article.steps} storageKey={`${area.slug}/${article.slug}`} next={next ? { href: `/ayuda/${next.area.slug}/${next.article.slug}`, title: next.article.title } : null} />

      {article.notes && article.notes.length > 0 && (
        <section className="mt-8 rounded-2xl border bg-subtle/50 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Info className="size-4 text-brand-600" aria-hidden /> Bueno saber
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-muted-foreground">
            {article.notes.map((n, k) => (
              <li key={k}>
                <Rich text={n} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Guías contiguas" className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/ayuda/${prev.area.slug}/${prev.article.slug}`} className="group rounded-2xl border p-4 hover:bg-subtle">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="size-3.5" aria-hidden /> Anterior · {prev.area.title}
            </span>
            <span className="mt-1 block font-semibold">{prev.article.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/ayuda/${next.area.slug}/${next.article.slug}`} className="group rounded-2xl border p-4 text-right hover:bg-subtle">
            <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
              Siguiente · {next.area.title} <ArrowRight className="size-3.5" aria-hidden />
            </span>
            <span className="mt-1 block font-semibold">{next.article.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
