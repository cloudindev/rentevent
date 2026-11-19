import type { Metadata } from "next";
import { Quote } from "lucide-react";
import { ClientLogos, Container, FinalCta, SectionTitle } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Clientes",
  description: "Empresas de carpas, productoras y organizadores de ferias que trabajan con Rentevent.",
  alternates: { canonical: "/clientes" },
};

const CASES = [
  { company: "Toldos Bravo", sector: "Carpas para eventos · 60 cerchas", quote: "Antes hacíamos el despiece en una hoja de cálculo por carpa. Ahora el comercial cambia el largo delante del cliente y ya sabe si hay material.", person: "Gerente", metric: "−70 %", metricLabel: "tiempo por presupuesto" },
  { company: "NORTE·EVENTS", sector: "Productora · 25 personas en montaje", quote: "El tablero nos avisa de los descansos antes de publicar el planning. En temporada alta eso es oro.", person: "Jefa de producción", metric: "0", metricLabel: "turnos solapados en verano" },
  { company: "AURA bodas", sector: "Bodas y celebraciones", quote: "Los novios ven su carpa en 3D desde el móvil y la comparten con la familia. Cerramos antes y con menos visitas.", person: "Directora comercial", metric: "2×", metricLabel: "presupuestos aceptados" },
];

export default function CustomersPage() {
  return (
    <>
      <section className="pb-16 pt-14 sm:pt-20">
        <Container>
          <SectionTitle eyebrow="Clientes" title="Empresas que ya montan con Rentevent" intro="Desde talleres familiares con una nave hasta productoras con varias cuadrillas en la carretera." />
        </Container>
      </section>
      <ClientLogos title="Algunos de nuestros clientes" />
      <section className="py-20">
        <Container className="grid gap-4 lg:grid-cols-3">
          {CASES.map((c) => (
            <figure key={c.company} className="flex flex-col rounded-2xl border p-6">
              <Quote className="size-6 text-brand-500" aria-hidden />
              <blockquote className="mt-4 flex-1 text-lg">“{c.quote}”</blockquote>
              <div className="mt-6 rounded-xl bg-subtle p-4">
                <p className="text-3xl font-bold">{c.metric}</p>
                <p className="text-sm text-muted-foreground">{c.metricLabel}</p>
              </div>
              <figcaption className="mt-5 text-sm">
                <strong>{c.company}</strong>
                <span className="block text-muted-foreground">
                  {c.person} · {c.sector}
                </span>
              </figcaption>
            </figure>
          ))}
        </Container>
        <Container>
          <p className="mt-6 text-center text-xs text-muted-foreground">Nombres de empresa ilustrativos.</p>
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
