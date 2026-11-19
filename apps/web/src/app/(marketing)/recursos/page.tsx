import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "@/content/posts";
import { formatDate } from "@/lib/utils";
import { Container, FinalCta, SectionTitle } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Recursos y blog",
  description: "Guías prácticas para empresas de carpas: cálculo de material, presupuestos, personal y operaciones.",
  alternates: { canonical: "/recursos" },
};

export default function ResourcesPage() {
  const [first, ...rest] = POSTS;
  return (
    <>
      <section className="py-14 sm:py-20">
        <Container>
          <SectionTitle eyebrow="Recursos" title="Ideas para montar mejor y vender más" intro="Guías cortas escritas desde la nave, no desde una oficina." />
          {first && (
            <Link href={`/recursos/blog/${first.slug}`} className="mt-10 grid gap-6 rounded-3xl border p-6 hover:bg-subtle sm:p-8 lg:grid-cols-2">
              <div className="flex aspect-[16/9] items-end rounded-2xl bg-ink p-6 text-white">
                <span className="text-5xl font-bold text-brand-400">n + 1</span>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-sm text-muted-foreground">
                  {first.category} · {first.minutes} min
                </p>
                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">{first.title}</h2>
                <p className="mt-3 text-muted-foreground">{first.description}</p>
              </div>
            </Link>
          )}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {rest.map((p) => (
              <Link key={p.slug} href={`/recursos/blog/${p.slug}`} className="rounded-2xl border p-6 hover:bg-subtle">
                <p className="text-sm text-muted-foreground">
                  {p.category} · {formatDate(p.date)}
                </p>
                <h2 className="mt-2 text-xl font-semibold">{p.title}</h2>
                <p className="mt-2 text-muted-foreground">{p.description}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
