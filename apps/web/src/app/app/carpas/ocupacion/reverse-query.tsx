"use client";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatusPill } from "@/components/ui/badge";
import { reverseAvailability } from "@/server/actions/availability";

type Result = Awaited<ReturnType<typeof reverseAvailability>>;

export function ReverseQuery() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [anchoring, setAnchoring] = useState<"anclaje" | "pesos">("anclaje");
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">¿Qué carpa puedo montar?</h2>
      <p className="mb-3 text-sm text-muted-foreground">Calcula el largo máximo montable por familia con el material libre en esas fechas.</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setRes(await reverseAvailability({ from, to, anchoring })));
        }}
      >
        <Field label="Desde" htmlFor="rq-from">
          <Input id="rq-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta" htmlFor="rq-to">
          <Input id="rq-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Fijación" htmlFor="rq-anch">
          <NativeSelect id="rq-anch" value={anchoring} onChange={(e) => setAnchoring(e.target.value as "anclaje" | "pesos")}>
            <option value="anclaje">Anclada</option>
            <option value="pesos">Con pesos</option>
          </NativeSelect>
        </Field>
        <Button disabled={pending}>
          <Search /> Calcular
        </Button>
      </form>
      {res && !res.ok && <p className="mt-3 text-sm text-danger">{res.error}</p>}
      {res?.ok && (
        <div className="mt-4 space-y-3">
          <p className="text-[15px] font-medium">{res.data.summary}</p>
          <Table>
            <THead>
              <TR>
                <TH>Familia</TH>
                <TH className="text-right">Largo máximo</TH>
                <TH>Medida</TH>
                <TH>Limita</TH>
              </TR>
            </THead>
            <TBody>
              {res.data.results.map((r) => (
                <TR key={r.familyId}>
                  <TD>{r.familyName}</TD>
                  <TD className="tabular text-right">{r.maxModules > 0 ? `${r.maxLength} m` : "—"}</TD>
                  <TD>{r.maxModules > 0 ? <StatusPill tone="success">{r.label}</StatusPill> : <StatusPill tone="danger">No disponible</StatusPill>}</TD>
                  <TD className="text-muted-foreground">{r.limitingItem ?? (r.maxModules > 0 ? "Largo máximo de la familia" : "—")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </section>
  );
}
