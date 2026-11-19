import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { COMPARISON, PLANS } from "@/components/marketing/content";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Container, FinalCta, SectionTitle } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Precios",
  description: "Planes de Rentevent para empresas de carpas y eventos: Básico, Profesional y Empresa. 14 días de prueba gratis sin tarjeta.",
  alternates: { canonical: "/precios" },
};

const FAQ = [
  ["¿Hay permanencia?", "No. Pagas mes a mes o un año por adelantado con un 20 % de descuento, y puedes cancelar cuando quieras."],
  ["¿Qué pasa al acabar la prueba?", "Eliges un plan y sigues con tus datos. Si no, tu cuenta queda en solo lectura 30 días para que exportes lo que necesites."],
  ["¿Los precios incluyen IVA?", "No, los precios se muestran sin IVA."],
  ["¿Cobráis por la migración?", "En el plan Profesional anual la migración desde tu programa actual está incluida."],
];

export default function PricingPage() {
  return (
    <>
      <section className="pb-10 pt-14 sm:pt-20">
        <Container>
          <SectionTitle center eyebrow="Precios" title="Un precio claro por usuario" intro="Empieza gratis 14 días con todo incluido. Sin tarjeta." />
          <PricingCards plans={PLANS} />
        </Container>
      </section>
      <section className="py-16">
        <Container>
          <h2 className="text-2xl font-bold">Compara los planes</h2>
          <div className="mt-6 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Comparativa de funciones por plan</caption>
              <thead className="bg-subtle">
                <tr>
                  <th scope="col" className="px-5 py-3 text-left font-medium">Función</th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className="px-5 py-3 text-center font-semibold">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              {COMPARISON.map((g) => (
                <tbody key={g.group}>
                  <tr className="border-t bg-background">
                    <th colSpan={4} scope="colgroup" className="px-5 pt-5 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.group}
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.label} className="border-t">
                      <th scope="row" className="px-5 py-3 text-left font-normal">
                        {r.label}
                      </th>
                      {r.values.map((v, i) => (
                        <td key={i} className="px-5 py-3 text-center">
                          {v === true ? <Check className="mx-auto size-4 text-success" aria-label="Incluido" /> : v === false ? <Minus className="mx-auto size-4 text-muted-foreground" aria-label="No incluido" /> : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </Container>
      </section>
      <section className="py-16">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-bold">Preguntas frecuentes</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-xl border p-4">
                <summary className="cursor-pointer font-medium">{q}</summary>
                <p className="mt-2 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
      <FinalCta />
    </>
  );
}
