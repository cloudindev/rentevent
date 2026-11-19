import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULES } from "@/components/marketing/content";
import { CheckList, Container, Eyebrow, FinalCta, MiniVisual, VISUAL_FOR } from "@/components/marketing/sections";

export const dynamicParams = false;
export function generateStaticParams() {
  return MODULES.map((m) => ({ modulo: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }): Promise<Metadata> {
  const { modulo } = await params;
  const m = MODULES.find((x) => x.slug === modulo);
  if (!m) return {};
  return { title: m.name, description: m.intro, alternates: { canonical: `/producto/${m.slug}` }, openGraph: { title: `${m.name} · Rentevent`, description: m.intro } };
}

export default async function ProductPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  const m = MODULES.find((x) => x.slug === modulo);
  if (!m) notFound();
  const others = MODULES.filter((x) => x.slug !== m.slug).slice(0, 4);
  return (
    <>
      <section className="pb-16 pt-14 sm:pt-20">
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>{m.name}</Eyebrow>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{m.headline}</h1>
            <p className="mt-6 text-lg text-muted-foreground">{m.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="xl" variant="dark">
                <Link href="/registro">Prueba gratis</Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="/contacto">Ver una demo</Link>
              </Button>
            </div>
          </div>
          <MiniVisual kind={VISUAL_FOR[m.slug] ?? "bom"} />
        </Container>
      </section>
      <section className="border-y bg-subtle py-20">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {m.features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-background p-6">
                <h2 className="font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <section className="py-20">
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Incluye</h2>
            <CheckList items={m.checklist} className="mt-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
            <dl className="mt-6 space-y-3">
              {m.faq.map((f) => (
                <details key={f.q} className="group rounded-xl border p-4">
                  <summary className="cursor-pointer list-none font-medium">
                    <dt className="inline">{f.q}</dt>
                  </summary>
                  <dd className="mt-2 text-muted-foreground">{f.a}</dd>
                </details>
              ))}
            </dl>
          </div>
        </Container>
      </section>
      <section className="pb-4">
        <Container>
          <h2 className="text-xl font-semibold">Otros módulos</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((o) => (
              <Link key={o.slug} href={`/producto/${o.slug}`} className="group rounded-2xl border p-5 hover:bg-subtle">
                <o.icon className="size-5 text-brand-600" aria-hidden />
                <p className="mt-3 font-semibold">{o.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{o.short}</p>
                <ArrowRight className="mt-3 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
