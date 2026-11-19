import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Cuboid, HardHat, Plug, ShieldCheck, Tent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppDemo } from "@/components/marketing/app-demo";
import { MODULES, SOLUTIONS } from "@/components/marketing/content";
import { CheckList, ClientLogos, Container, FeatureRow, FinalCta, MiniVisual, SectionTitle } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: { absolute: "Rentevent · Software para empresas de carpas y eventos" },
  description: "Configura carpas con despiece automático, comprueba el stock de cerchas mientras presupuestas y enseña la carpa en 3D. Personal, almacén y facturación en un solo sitio.",
  alternates: { canonical: "/" },
};

const ADVANTAGES = [
  { icon: Tent, title: "Carpas y stock", text: "Despiece automático por familia y disponibilidad real de cada cercha, también cuando se comparte entre carpas.", href: "/producto/disponibilidad" },
  { icon: HardHat, title: "Personal", text: "Turnos calculados desde el despiece, avisos de solapes y una app para que la cuadrilla fiche y firme en obra.", href: "/producto/personal" },
  { icon: Cuboid, title: "Presupuestos con 3D", text: "El cliente ve su carpa, el plano acotado y el precio en el mismo enlace, y lo acepta con su firma.", href: "/producto/visor-3d" },
];

const INTEGRATIONS = ["Stripe", "Google", "Microsoft 365", "WhatsApp", "Calendario ICS", "Exportación contable", "API REST", "Webhooks"];

export default function HomePage() {
  return (
    <>
      <section className="overflow-hidden pb-16 pt-14 sm:pt-20">
        <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand-500" /> Para empresas de carpas y estructuras
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">El software que sabe lo que es una carpa.</h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
              Presupuesta una 15x30 en dos minutos: despiece automático, cerchas disponibles en vivo y la carpa en 3D para tu cliente.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="xl" variant="dark">
                <Link href="/registro">
                  Prueba gratis <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link href="/contacto">Hablar con un experto</Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-success" aria-hidden /> 14 días gratis · sin tarjeta · datos alojados en la UE
            </p>
          </div>
          <AppDemo />
        </Container>
      </section>

      <ClientLogos />

      <section className="py-20 sm:py-24">
        <Container>
          <SectionTitle center eyebrow="Por qué Rentevent" title="Tres cosas que un software genérico de alquiler no hace" />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {ADVANTAGES.map((a) => (
              <Link key={a.title} href={a.href} className="group rounded-2xl border p-6 transition-colors hover:border-border-strong hover:bg-subtle">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <a.icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{a.title}</h3>
                <p className="mt-2 text-muted-foreground">{a.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-link">
                  Ver cómo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-subtle py-20 sm:py-24">
        <Container>
          <SectionTitle eyebrow="Sectores" title="Del mercado navideño a la boda en la finca" intro="Una misma base para cualquier empresa que monta estructuras temporales." />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SOLUTIONS.map((s) => (
              <Link key={s.slug} href={`/soluciones/${s.slug}`} className="rounded-2xl border bg-background p-5 transition-colors hover:border-border-strong">
                <s.icon className="size-6 text-foreground/70" strokeWidth={1.6} aria-hidden />
                <h3 className="mt-6 font-semibold">{s.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.short}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-28">
        <Container className="space-y-24">
          <FeatureRow
            eyebrow="Configurador de carpas"
            title="Cambia el largo y el despiece se recalcula solo"
            text="Pórticos, pilares, correas, lonas, picos y lastre salen de reglas que tu equipo puede editar. Sin tablas de medidas fijas."
            checklist={["Familias de 7 a 20 m, dos aguas o poligonal", "Laterales decididos tramo a tramo", "Peso, volumen, camiones y horas de montaje"]}
            visual={<MiniVisual kind="bom" />}
            href="/producto/configurador-carpas"
          />
          <FeatureRow
            reverse
            eyebrow="Disponibilidad"
            title="Sabes cuántas cerchas quedan antes de enviar el presupuesto"
            text="Rentevent usa el pico de ocupación entre la carga y el retorno, no una suma aproximada. Y si no llega, te propone alternativas."
            checklist={["Opciones con caducidad automática", "Respuesta inversa: largo máximo por familia", "Subalquiler a proveedor en un clic"]}
            visual={<MiniVisual kind="availability" />}
            href="/producto/disponibilidad"
          />
          <FeatureRow
            eyebrow="Personal"
            title="Turnos que respetan el descanso y las habilidades"
            text="Las horas de cada fase salen del despiece. El tablero avisa de solapes, carnés que faltan o formación caducada antes de guardar."
            checklist={["Sugerencia automática de cuadrilla", "App sin conexión para montadores", "Registro horario y exportación para nóminas"]}
            visual={<MiniVisual kind="gantt" />}
            href="/producto/personal"
          />
          <FeatureRow
            reverse
            eyebrow="Presupuestos"
            title="Del borrador a la firma sin salir de la pantalla"
            text="PDF con tu marca, imagen 3D y plano acotado. El cliente lo acepta desde el móvil y el material queda reservado."
            checklist={["Tarifas por m², metro lineal, unidad o día", "Transporte por kilómetro", "Margen visible solo para quien debe verlo"]}
            visual={<MiniVisual kind="quote" />}
            href="/producto/presupuestos"
          />
        </Container>
      </section>

      <section className="border-y bg-subtle py-20">
        <Container className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Integraciones" title="Se conecta con lo que ya usas" intro="Pagos, calendario, correo, mensajería y tu asesoría contable. Y una API abierta para todo lo demás." />
            <CheckList className="mt-6" items={["Webhooks para cada cambio de estado", "Importación desde CSV, Excel y otros programas de alquiler"]} />
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {INTEGRATIONS.map((i) => (
              <li key={i} className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-background text-center text-sm font-medium">
                <Plug className="size-4 text-muted-foreground" aria-hidden />
                {i}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <SectionTitle center eyebrow="Todo el producto" title="Un módulo para cada parte de tu operación" />
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <Link key={m.slug} href={`/producto/${m.slug}`} className="rounded-2xl border p-5 hover:bg-subtle">
                <m.icon className="size-5 text-brand-600" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-4 font-semibold">{m.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.short}</p>
              </Link>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <CalendarCheck className="size-4" aria-hidden /> Migramos tus datos desde tu programa actual sin coste en el plan Profesional.
          </p>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
