import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULES, SOLUTIONS } from "@/components/marketing/content";
import { Container, Eyebrow, FeatureRow, FinalCta, MiniVisual, VISUAL_FOR } from "@/components/marketing/sections";

export const dynamicParams = false;
export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ tipo: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }): Promise<Metadata> {
  const { tipo } = await params;
  const s = SOLUTIONS.find((x) => x.slug === tipo);
  if (!s) return {};
  return { title: `Rentevent para ${s.name.toLowerCase()}`, description: s.intro, alternates: { canonical: `/soluciones/${s.slug}` } };
}

export default async function SolutionPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const s = SOLUTIONS.find((x) => x.slug === tipo);
  if (!s) notFound();
  const mods = s.modules.map((slug) => MODULES.find((m) => m.slug === slug)!).filter(Boolean);
  return (
    <>
      <section className="pb-16 pt-14 sm:pt-20">
        <Container className="max-w-4xl text-center">
          <s.icon className="mx-auto size-8 text-brand-600" strokeWidth={1.6} aria-hidden />
          <Eyebrow>{s.name}</Eyebrow>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{s.headline}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{s.intro}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="xl" variant="dark">
              <Link href="/registro">Prueba gratis</Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/contacto">Hablar con un experto</Link>
            </Button>
          </div>
        </Container>
      </section>
      <section className="border-y bg-subtle py-16">
        <Container>
          <h2 className="text-center text-2xl font-bold">Lo que resolvemos</h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            {s.pains.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-2xl border bg-background p-5">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>
      <section className="py-20">
        <Container className="space-y-20">
          {mods.map((m, i) => (
            <FeatureRow key={m.slug} reverse={i % 2 === 1} eyebrow={m.name} title={m.headline} text={m.intro} checklist={m.checklist.slice(0, 3)} visual={<MiniVisual kind={VISUAL_FOR[m.slug] ?? "bom"} />} href={`/producto/${m.slug}`} />
          ))}
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
