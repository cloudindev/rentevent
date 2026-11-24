import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Footprints, Search } from "lucide-react";
import { HELP_AREAS, HELP_GROUPS, searchIndex, type HelpArea } from "@/content/help";
import { HELP_ICONS } from "@/components/help/icons";
import { HelpSearch } from "@/components/help/search";
import { Container, FinalCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Centro de ayuda",
  description: "Guías paso a paso de cada área de Rentevent: pedidos, configurador de carpas y reglas de despiece, inventario, cajas de transporte y QR, almacén, personal, finanzas y configuración.",
  alternates: { canonical: "/ayuda" },
};

/** First guide of an area whose slug mentions one of the words (falls back to the first guide). */
function pick(area: string, ...words: string[]) {
  const a = HELP_AREAS.find((x) => x.slug === area);
  if (!a?.articles.length) return null;
  const art = a.articles.find((x) => words.some((w) => x.slug.includes(w))) ?? a.articles[0]!;
  return { href: `/ayuda/${a.slug}/${art.slug}`, title: art.title, area: a.title };
}

export default function HelpHome() {
  const total = HELP_AREAS.reduce((s, a) => s + a.articles.length, 0);
  const starts = [pick("primeros-pasos", "onboarding", "asistente", "configuracion-inicial"), pick("carpas", "familia"), pick("pedidos", "crear", "nuevo"), pick("almacen", "carga", "salida"), pick("inventario", "caja", "contenedor"), pick("personal", "tablero", "planific")].filter(
    (x): x is NonNullable<typeof x> => x !== null,
  );
  return (
    <>
      <section className="border-b bg-subtle py-14 sm:py-20">
        <Container className="max-w-3xl text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-brand-700">
            <BookOpen className="size-4" aria-hidden /> Centro de ayuda
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">¿Qué quieres hacer en Rentevent?</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {HELP_AREAS.length} áreas y {total} guías paso a paso, con todo lo que hay en el panel: desde configurar una familia de carpas hasta escanear una caja de transporte.
          </p>
          <HelpSearch entries={searchIndex()} className="mt-8 text-left" />
        </Container>
      </section>

      {starts.length > 0 && (
        <section className="py-12">
          <Container>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Footprints className="size-5 text-brand-600" aria-hidden /> Para empezar
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {starts.map((s) => (
                <Link key={s.href} href={s.href} className="group flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-950/40">
                  <span>
                    <span className="block text-xs text-muted-foreground">{s.area}</span>
                    <span className="mt-0.5 block font-semibold">{s.title}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="pb-20">
        <Container className="space-y-12">
          {HELP_GROUPS.map((g) => (
            <div key={g.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.areas.map((a) => (
                  <AreaCard key={a.slug} area={a} />
                ))}
              </div>
            </div>
          ))}
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Search className="size-4" aria-hidden /> Pulsa <kbd className="rounded border bg-subtle px-1.5 text-xs">/</kbd> en cualquier momento para buscar.
          </p>
        </Container>
      </section>
      <FinalCta title="¿Prefieres que te lo enseñemos?" text="En 30 minutos configuramos contigo una familia de carpas, cargamos tu stock y presupuestamos un evento real." />
    </>
  );
}

function AreaCard({ area }: { area: HelpArea }) {
  const Icon = HELP_ICONS[area.slug] ?? BookOpen;
  return (
    <div className="flex flex-col rounded-2xl border p-5 transition-colors hover:border-border-strong">
      <Link href={`/ayuda/${area.slug}`} className="group">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <h3 className="mt-4 font-semibold group-hover:underline">{area.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{area.summary}</p>
      </Link>
      <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
        {area.articles.slice(0, 4).map((x) => (
          <li key={x.slug}>
            <Link href={`/ayuda/${area.slug}/${x.slug}`} className="text-foreground/80 hover:text-brand-700 hover:underline">
              {x.title}
            </Link>
          </li>
        ))}
      </ul>
      {area.articles.length > 4 && (
        <Link href={`/ayuda/${area.slug}`} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
          Ver las {area.articles.length} guías →
        </Link>
      )}
    </div>
  );
}
