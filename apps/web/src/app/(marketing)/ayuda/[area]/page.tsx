import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { findArea, HELP_AREAS } from "@/content/help";
import { HELP_ICONS } from "@/components/help/icons";
import { Rich, plain } from "@/components/help/rich";

export const dynamicParams = false;
export const generateStaticParams = () => HELP_AREAS.map((a) => ({ area: a.slug }));

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const a = findArea((await params).area);
  return a ? { title: `${a.title} · Ayuda`, description: plain(a.summary), alternates: { canonical: `/ayuda/${a.slug}` } } : {};
}

export default async function HelpAreaPage({ params }: { params: Promise<{ area: string }> }) {
  const area = findArea((await params).area);
  if (!area) notFound();
  const Icon = HELP_ICONS[area.slug] ?? BookOpen;
  const i = HELP_AREAS.indexOf(area);
  const next = HELP_AREAS[i + 1];
  return (
    <article>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950">
        <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{area.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        <Rich text={area.summary} />
      </p>

      <section className="mt-8 space-y-4 text-[15px] leading-relaxed text-foreground/85">
        {area.overview.map((p, k) => (
          <p key={k}>
            <Rich text={p} />
          </p>
        ))}
      </section>

      {area.concepts && area.concepts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Conceptos clave</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {area.concepts.map((c) => (
              <div key={c.term} className="rounded-xl border bg-subtle/50 p-4">
                <dt className="font-semibold">{c.term}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  <Rich text={c.definition} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Guías paso a paso</h2>
        <ol className="mt-4 divide-y rounded-2xl border">
          {area.articles.map((x, k) => (
            <li key={x.slug}>
              <Link href={`/ayuda/${area.slug}/${x.slug}`} className="group flex items-start gap-4 p-4 hover:bg-subtle sm:p-5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold tabular group-hover:bg-brand-100 group-hover:text-brand-700 dark:group-hover:bg-brand-900">{k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold group-hover:text-brand-700">{x.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    <Rich text={x.summary} />
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{x.steps.length} pasos</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {next && (
        <Link href={`/ayuda/${next.slug}`} className="mt-10 flex items-center justify-between gap-3 rounded-2xl border p-5 hover:bg-subtle">
          <span>
            <span className="block text-xs text-muted-foreground">Siguiente área</span>
            <span className="mt-0.5 block font-semibold">{next.title}</span>
          </span>
          <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </article>
  );
}
