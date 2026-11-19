import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL } from "@/components/marketing/legal";
import { Container } from "@/components/marketing/sections";
import { formatDate } from "@/lib/utils";

export const dynamicParams = false;
export function generateStaticParams() {
  return LEGAL.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const d = LEGAL.find((x) => x.slug === doc);
  return d ? { title: d.title, alternates: { canonical: `/legal/${d.slug}` } } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = LEGAL.find((x) => x.slug === doc);
  if (!d) notFound();
  return (
    <section className="py-14 sm:py-20">
      <Container className="grid max-w-5xl gap-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Documentos legales" className="text-sm">
          <ul className="space-y-1 lg:sticky lg:top-24">
            {LEGAL.map((l) => (
              <li key={l.slug}>
                <Link href={`/legal/${l.slug}`} aria-current={l.slug === d.slug ? "page" : undefined} className={`block rounded-lg px-3 py-2 hover:bg-accent ${l.slug === d.slug ? "bg-accent font-medium" : "text-muted-foreground"}`}>
                  {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article>
          <h1 className="text-4xl font-bold tracking-tight">{d.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Última actualización: {formatDate(d.updated)}</p>
          {d.sections.map((s) => (
            <section key={s.h} className="mt-10">
              <h2 className="text-xl font-semibold">{s.h}</h2>
              {s.p.map((p, i) => (
                <p key={i} className="mt-3 leading-relaxed text-foreground/85">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>
      </Container>
    </section>
  );
}
