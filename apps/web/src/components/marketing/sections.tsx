import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TentIllustration } from "./tent-illustration";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 [&>*]:min-w-0", className)}>{children}</div>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{children}</p>;
}

export function SectionTitle({ eyebrow, title, intro, center }: { eyebrow?: string; title: string; intro?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-lg text-muted-foreground">{intro}</p>}
    </div>
  );
}

export function CheckList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((i) => (
        <li key={i} className="flex items-start gap-2.5 text-[15px]">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          {i}
        </li>
      ))}
    </ul>
  );
}

const LOGOS = ["Toldos Bravo", "NORTE·EVENTS", "Carpas Ría", "festiva", "MONTAJES ESTE", "Jaimas Sur", "AURA bodas"];

export function ClientLogos({ title = "Empresas de carpas y eventos que ya trabajan con Rentevent" }: { title?: string }) {
  return (
    <section aria-label="Clientes" className="border-y bg-subtle py-10">
      <Container>
        <p className="text-center text-sm text-muted-foreground">{title}</p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-foreground/40 grayscale">
          {LOGOS.map((l, i) => (
            <li key={l} className={cn("text-lg tracking-tight", i % 3 === 0 ? "font-black uppercase" : i % 3 === 1 ? "font-semibold italic" : "font-bold")}>
              {l}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function FinalCta({ title = "Monta tu próxima carpa con Rentevent", text = "14 días gratis, sin tarjeta. Te ayudamos a cargar tus familias de carpa y tu stock." }: { title?: string; text?: string }) {
  return (
    <section className="py-20">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/25 blur-3xl" aria-hidden />
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">{text}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="xl">
              <Link href="/registro">Prueba gratis</Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
              <Link href="/contacto">Hablar con un experto</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}

/** Small product visuals for alternating modules (no screenshots, pure markup). */
export function MiniVisual({ kind }: { kind: "bom" | "gantt" | "warehouse" | "quote" | "tent" | "finance" | "ai" | "availability" }) {
  const frame = "rounded-2xl border bg-canvas p-2 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.3)]";
  const inner = "rounded-xl border bg-background p-4";
  if (kind === "tent")
    return (
      <div className={frame} aria-hidden>
        <div className={cn(inner, "bg-gradient-to-b from-subtle to-background")}>
          <TentIllustration modules={6} transparentBays={3} openRoofBays={1} className="w-full text-foreground" />
        </div>
      </div>
    );
  if (kind === "bom")
    return (
      <div className={frame} aria-hidden>
        <div className={inner}>
          <p className="text-xs text-muted-foreground">Despiece · Carpa 15x30 poligonal</p>
          {[
            ["Cercha 15 m pata baja", "7"],
            ["Pilar pata baja", "14"],
            ["Correa 5 m", "42"],
            ["Lona de techo 15x5", "5"],
            ["Lateral transparente", "6"],
            ["Peso 500 kg", "28"],
          ].map(([a, b]) => (
            <div key={a} className="flex justify-between border-b py-2 text-sm last:border-0">
              <span>{a}</span>
              <span className="tabular-nums font-medium">{b}</span>
            </div>
          ))}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ["14,9 t", "peso"],
              ["450 m²", "superficie"],
              ["38 h", "montaje"],
            ].map(([a, b]) => (
              <div key={b} className="rounded-lg bg-subtle p-2">
                <p className="font-semibold">{a}</p>
                <p className="text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  if (kind === "availability")
    return (
      <div className={frame} aria-hidden>
        <div className={inner}>
          <p className="text-xs text-muted-foreground">Del 12 al 15 de diciembre puedes montar hasta…</p>
          {[
            ["Carpa 10 m", "10x35", 70],
            ["Carpa 15 m alta", "15x20", 45],
            ["Carpa 20 m alta", "20x40", 90],
            ["Carpa 10 m extra", "10x15", 30],
          ].map(([a, b, w]) => (
            <div key={a as string} className="mt-3">
              <div className="flex justify-between text-sm">
                <span>{a}</span>
                <span className="font-semibold">{b}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-secondary">
                <div className="h-2 rounded-full bg-brand-500" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (kind === "gantt")
    return (
      <div className={frame} aria-hidden>
        <div className={inner}>
          <div className="grid grid-cols-[90px_repeat(5,1fr)] gap-1 text-[11px]">
            <span />
            {["Lun", "Mar", "Mié", "Jue", "Vie"].map((d) => (
              <span key={d} className="text-muted-foreground">
                {d}
              </span>
            ))}
            {[
              ["Rubén", 1, 2, "bg-brand-100 text-brand-800", "Montaje boda"],
              ["Adrián", 1, 2, "bg-brand-100 text-brand-800", "Montaje boda"],
              ["Héctor", 3, 2, "bg-info-bg text-info", "Mercado"],
              ["Sara", 2, 1, "bg-secondary", "Carga"],
              ["Óscar", 4, 2, "bg-success-bg text-success", "Desmontaje"],
            ].map(([n, start, span, cls, l]) => (
              <div key={n as string} className="contents">
                <span className="py-1">{n}</span>
                <span className={cn("truncate rounded-md px-1.5 py-1", cls as string)} style={{ gridColumn: `${(start as number) + 1} / span ${span as number}` }}>
                  {l}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-warning-bg px-2.5 py-1.5 text-xs text-warning">Héctor: solo 9 h de descanso entre jornadas</p>
        </div>
      </div>
    );
  if (kind === "warehouse")
    return (
      <div className={frame} aria-hidden>
        <div className={inner}>
          <p className="text-xs text-muted-foreground">Lista de carga · Pedido 262087</p>
          {[
            ["A-01", "Cercha 15 m", "7 / 7", "ok"],
            ["A-03", "Pilar pata baja", "14 / 14", "ok"],
            ["C-02", "Lona techo 15x5", "3 / 5", "warn"],
            ["D-07", "Peso 500 kg", "0 / 28", "none"],
          ].map(([loc, n, q, st]) => (
            <div key={n} className="flex items-center gap-3 border-b py-2 text-sm last:border-0">
              <span className="w-10 font-mono text-xs text-muted-foreground">{loc}</span>
              <span className="flex-1">{n}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", st === "ok" ? "bg-success-bg text-success" : st === "warn" ? "bg-warning-bg text-warning" : "bg-secondary")}>{q}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (kind === "quote")
    return (
      <div className={frame} aria-hidden>
        <div className={inner}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Presupuesto 262087 · v2</p>
            <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs text-success">Firmado</span>
          </div>
          {[
            ["Carpa 15x30 poligonal (450 m²)", "4.050,00 €"],
            ["Laterales transparentes ×6", "108,00 €"],
            ["Transporte 75 km", "240,00 €"],
            ["Montaje y desmontaje", "1.140,00 €"],
          ].map(([a, b]) => (
            <div key={a} className="flex justify-between border-b py-2 text-sm">
              <span className="text-muted-foreground">{a}</span>
              <span className="tabular-nums">{b}</span>
            </div>
          ))}
          <div className="flex justify-between pt-3 text-base font-semibold">
            <span>Total (IVA incl.)</span>
            <span className="tabular-nums">6.700,98 €</span>
          </div>
          <p className="mt-3 font-[cursive] text-2xl text-foreground/70">Ana R.</p>
        </div>
      </div>
    );
  if (kind === "finance")
    return (
      <div className={frame} aria-hidden>
        <div className={inner}>
          <p className="text-xs text-muted-foreground">Facturación 2026</p>
          <div className="mt-3 flex h-28 items-end gap-2">
            {[38, 52, 46, 70, 88, 64, 92].map((h, i) => (
              <div key={i} className={cn("flex-1 rounded-t-md", i === 6 ? "bg-brand-500" : "bg-secondary")} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-subtle p-2">
              <p className="text-xs text-muted-foreground">Pendiente de cobro</p>
              <p className="font-semibold">18.420 €</p>
            </div>
            <div className="rounded-lg bg-subtle p-2">
              <p className="text-xs text-muted-foreground">Margen medio</p>
              <p className="font-semibold">41 %</p>
            </div>
          </div>
        </div>
      </div>
    );
  return (
    <div className={frame} aria-hidden>
      <div className={cn(inner, "space-y-3 text-sm")}>
        <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-white">¿Qué carpa puedo montar el 12 de diciembre?</p>
        <p className="max-w-[90%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2">Ese día tienes 19 cerchas de 10 m libres: hasta una 10x90. En 15 m alta, hasta 15x60. ¿Te preparo un borrador?</p>
        <p className="ml-auto w-fit rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-white">Sí, 10x40 para Hotel Playa Mayor</p>
        <p className="w-fit rounded-2xl rounded-bl-sm bg-brand-50 px-3 py-2 text-brand-800">Borrador 262091 creado →</p>
      </div>
    </div>
  );
}

export function FeatureRow({ eyebrow, title, text, checklist, visual, reverse, href }: { eyebrow: string; title: string; text: string; checklist: string[]; visual: React.ReactNode; reverse?: boolean; href?: string }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn(reverse && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
        <p className="mt-4 text-lg text-muted-foreground">{text}</p>
        <CheckList items={checklist} className="mt-6" />
        {href && (
          <Link href={href} className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-link hover:underline">
            Saber más <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className={cn(reverse && "lg:order-1")}>{visual}</div>
    </div>
  );
}

export const VISUAL_FOR: Record<string, Parameters<typeof MiniVisual>[0]["kind"]> = {
  "configurador-carpas": "bom",
  disponibilidad: "availability",
  "visor-3d": "tent",
  presupuestos: "quote",
  personal: "gantt",
  almacen: "warehouse",
  finanzas: "finance",
  ia: "ai",
};
