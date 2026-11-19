"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CatalogFamily } from "@/server/catalog";
import { saveManufacturerData } from "@/server/actions/tents";

const FIELDS = [
  { key: "correas_por_tramo", label: "Correas por tramo", hint: "Perfiles longitudinales entre dos pórticos" },
  { key: "tensores_por_arriostramiento", label: "Tensores por arriostramiento", hint: "Cables en cruz por cada tramo arriostrado" },
  { key: "pesos_por_pata", label: "Pesos por pata", hint: "Bloques de lastre en cada pata cuando no se puede anclar" },
  { key: "peso_kg", label: "Kg por peso", hint: "Peso de cada bloque" },
  { key: "estacas_por_pata", label: "Estacas por pata", hint: "Anclajes al terreno en cada pata" },
];
const LABOR = [
  { key: "minPorPortico", label: "Minutos-persona por pórtico" },
  { key: "minPorLonaTecho", label: "Minutos por lona de techo" },
  { key: "minPorLateral", label: "Minutos por lateral" },
] as const;

export function ManufacturerWizard({ families }: { families: CatalogFamily[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => families.map((f) => ({ id: f.id, parameters: { ...f.parameters }, labor: { ...f.labor } })));
  const [pending, start] = useTransition();
  const f = families[step];
  const d = data[step];
  if (!f || !d) return <p className="text-sm text-muted-foreground">No hay familias de carpa todavía.</p>;
  const last = step === families.length - 1;
  return (
    <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <ol className="space-y-1">
        {families.map((x, i) => (
          <li key={x.id}>
            <button onClick={() => setStep(i)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent", i === step && "bg-accent font-medium")}>
              <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px]", i < step && "border-success bg-success text-white")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
              {x.name}
            </button>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">
            {f.name} <span className="font-normal text-muted-foreground">· {f.width} m · pata {f.heightClass}</span>
          </h3>
          {f.parametersPending ? <StatusPill tone="warning">Valores de ejemplo</StatusPill> : <StatusPill tone="success">Validada</StatusPill>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((fl) => (
            <Field key={fl.key} label={fl.label} hint={fl.hint} htmlFor={`w-${fl.key}`}>
              <Input
                id={`w-${fl.key}`}
                type="number"
                min={0}
                step="1"
                value={d.parameters[fl.key] ?? 0}
                onChange={(e) => setData((all) => all.map((x, i) => (i === step ? { ...x, parameters: { ...x.parameters, [fl.key]: Number(e.target.value) } } : x)))}
              />
            </Field>
          ))}
          {LABOR.map((fl) => (
            <Field key={fl.key} label={fl.label} htmlFor={`w-${fl.key}`}>
              <Input id={`w-${fl.key}`} type="number" min={0} value={d.labor[fl.key]} onChange={(e) => setData((all) => all.map((x, i) => (i === step ? { ...x, labor: { ...x.labor, [fl.key]: Number(e.target.value) } } : x)))} />
            </Field>
          ))}
        </div>
        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Anterior
          </Button>
          {last ? (
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveManufacturerData({ families: data });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Datos del fabricante guardados");
                  router.push("/app/carpas");
                  router.refresh();
                })
              }
            >
              Guardar todo
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>Siguiente</Button>
          )}
        </div>
      </div>
    </div>
  );
}
