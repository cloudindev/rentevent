"use client";
import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Plan } from "./content";

export const ANNUAL_DISCOUNT = 0.2;

export function PricingCards({ plans }: { plans: Plan[] }) {
  const [annual, setAnnual] = useState(true);
  return (
    <>
      <div className="mt-8 flex justify-center">
        <div role="radiogroup" aria-label="Periodo de facturación" className="inline-flex rounded-full border bg-subtle p-1 text-sm">
          {[
            [false, "Mensual"],
            [true, "Anual · −20 %"],
          ].map(([v, l]) => (
            <button
              key={String(v)}
              role="radio"
              aria-checked={annual === v}
              onClick={() => setAnnual(v as boolean)}
              className={cn("rounded-full px-4 py-1.5 font-medium transition-colors", annual === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {l as string}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const price = p.monthly == null ? null : annual ? Math.round(p.monthly * (1 - ANNUAL_DISCOUNT)) : p.monthly;
          return (
            <div key={p.id} className={cn("relative flex flex-col rounded-2xl border p-6", p.highlight && "border-ink shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)] dark:border-white")}>
              {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white">Más elegido</span>}
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                {price == null ? (
                  <span className="text-4xl font-bold tracking-tight">A medida</span>
                ) : (
                  <>
                    <span className="text-4xl font-bold tracking-tight tabular-nums">{price} €</span>
                    <span className="text-sm text-muted-foreground">/ usuario y mes</span>
                  </>
                )}
              </p>
              <p className="mt-1 h-5 text-xs text-muted-foreground">{price != null && annual ? `Facturado anualmente (${price * 12} € por usuario)` : price != null ? "Facturado mensualmente" : ""}</p>
              <Button asChild className="mt-6" size="lg" variant={p.highlight ? "default" : p.monthly == null ? "outline" : "dark"}>
                <Link href={p.monthly == null ? "/contacto" : `/registro?plan=${p.id}`}>{p.cta}</Link>
              </Button>
              <ul className="mt-6 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
