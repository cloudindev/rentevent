"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { durationFactor, type PricingSettings } from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { savePricing } from "@/server/actions/settings";

type Fam = { id: string; name: string; price: number; priceMode: "m2" | "ml" };

export function PricingForm({ initial, families }: { initial: PricingSettings; families: Fam[] }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [fams, setFams] = useState(families);
  const [pending, start] = useTransition();
  const num = (k: keyof PricingSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Number(e.target.value) });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Carpas por superficie</CardTitle>
            <CardDescription>Precio base de cada familia: incluye estructura, lonas blancas, montaje estándar y los días incluidos.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {fams.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{f.name}</span>
              <Input aria-label={`Precio ${f.name}`} type="number" step="0.1" min={0} className="w-28 text-right" value={f.price} onChange={(e) => setFams(fams.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
              <NativeSelect aria-label={`Unidad ${f.name}`} className="w-36" value={f.priceMode} onChange={(e) => setFams(fams.map((x, j) => (j === i ? { ...x, priceMode: e.target.value as "m2" | "ml" } : x)))}>
                <option value="m2">€ / m²</option>
                <option value="ml">€ / metro lineal</option>
              </NativeSelect>
            </div>
          ))}
          {fams.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay familias de carpa.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Duración</CardTitle>
            <CardDescription>Factor sobre la tarifa diaria de los artículos “por día”. Entre tramos se interpola.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.durationTiers.map((t, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <Input aria-label="Días" type="number" min={1} className="w-24" value={t.days} onChange={(e) => setP({ ...p, durationTiers: p.durationTiers.map((x, j) => (j === i ? { ...x, days: Number(e.target.value) } : x)) })} />
              <span className="text-muted-foreground">días →</span>
              <Input aria-label="Factor" type="number" step="0.05" min={0} className="w-24" value={t.factor} onChange={(e) => setP({ ...p, durationTiers: p.durationTiers.map((x, j) => (j === i ? { ...x, factor: Number(e.target.value) } : x)) })} />
              <span className="text-muted-foreground">× tarifa diaria</span>
              <Button variant="ghost" size="icon-sm" aria-label="Quitar tramo" disabled={p.durationTiers.length <= 1} onClick={() => setP({ ...p, durationTiers: p.durationTiers.filter((_, j) => j !== i) })}><Trash2 /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setP({ ...p, durationTiers: [...p.durationTiers, { days: (p.durationTiers.at(-1)?.days ?? 1) + 7, factor: (p.durationTiers.at(-1)?.factor ?? 1) + 1 }] })}><Plus /> Tramo</Button>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Factor por día adicional" htmlFor="p-extra"><Input id="p-extra" type="number" step="0.05" value={p.extraDayFactor} onChange={num("extraDayFactor")} /></Field>
            <Field label="Días incluidos en carpas" htmlFor="p-incl"><Input id="p-incl" type="number" min={1} value={p.tentIncludedDays} onChange={num("tentIncludedDays")} /></Field>
            <Field label="% por día extra de carpa" htmlFor="p-tex"><Input id="p-tex" type="number" step="0.5" value={p.tentExtraDayPct} onChange={num("tentExtraDayPct")} /></Field>
          </div>
          <p className="text-xs text-muted-foreground">Ejemplo: 5 días → × {durationFactor(5, p.durationTiers, p.extraDayFactor)} · 10 días → × {durationFactor(10, p.durationTiers, p.extraDayFactor)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Suplementos, transporte y mano de obra</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="IVA general %" htmlFor="p-vat"><Input id="p-vat" type="number" value={p.vatRate} onChange={num("vatRate")} /></Field>
          <Field label="Suplemento festivo %" htmlFor="p-hol"><Input id="p-hol" type="number" value={p.holidaySurchargePct} onChange={num("holidaySurchargePct")} /></Field>
          <span />
          <Field label="Transporte €/km (ida y vuelta)" htmlFor="p-km"><Input id="p-km" type="number" step="0.05" value={p.transportPerKm} onChange={num("transportPerKm")} /></Field>
          <Field label="Transporte mínimo €" htmlFor="p-min"><Input id="p-min" type="number" value={p.transportMinimum} onChange={num("transportMinimum")} /></Field>
          <Field label="Coste transporte €/km" htmlFor="p-ckm" hint="Para el margen"><Input id="p-ckm" type="number" step="0.05" value={p.transportCostPerKm} onChange={num("transportCostPerKm")} /></Field>
          <Field label="Mano de obra €/h" htmlFor="p-lab"><Input id="p-lab" type="number" step="0.5" value={p.laborPricePerHour} onChange={num("laborPricePerHour")} /></Field>
          <Field label="Coste mano de obra €/h" htmlFor="p-clab" hint="Para el margen"><Input id="p-clab" type="number" step="0.5" value={p.laborCostPerHour} onChange={num("laborCostPerHour")} /></Field>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePricing({ ...p, families: fams.map((f) => ({ id: f.id, price: f.price, priceMode: f.priceMode })) });
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success("Tarifas guardadas");
              router.refresh();
            })
          }
        >
          Guardar tarifas
        </Button>
      </div>
    </div>
  );
}
