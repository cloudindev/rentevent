"use client";
import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import type { BomItem, BomRule, Composition, StructureFamily } from "@rentevent/core";
import { TentViewer } from "@/components/tent3d";
import { SignaturePad } from "@/components/crew/signature-pad";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/menu";
import { acceptQuote } from "./actions";

export function PublicQuoteClient({ token, composition, families, items, rules, accepted, signer, expired, blocked }: { token: string; composition: Composition | null; families: StructureFamily[]; items: BomItem[]; rules: BomRule[]; accepted: boolean; signer: string | null; expired: boolean; blocked: string | null }) {
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [done, setDone] = useState<{ confirmed: boolean } | null>(accepted ? { confirmed: true } : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {composition ? (
        <div className="h-[420px] overflow-hidden rounded-xl border bg-card">
          <TentViewer composition={composition} families={families} items={items} rules={rules} showHuman showDimensions className="h-full" />
        </div>
      ) : (
        <div />
      )}
      <section className="rounded-xl border bg-card p-5">
        {done ? (
          <div className="space-y-2 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h2 className="text-lg font-semibold">Presupuesto aceptado</h2>
            <p className="text-sm text-muted-foreground">{signer ? `Firmado por ${signer}. ` : ""}{done.confirmed ? "Tu reserva queda confirmada. Te contactaremos para coordinar el montaje." : "Hemos recibido tu aceptación; el equipo revisará la disponibilidad y te confirmará la reserva."}</p>
          </div>
        ) : blocked ? (
          <p className="text-sm text-muted-foreground">{blocked}</p>
        ) : expired ? (
          <p className="text-sm text-muted-foreground">Este presupuesto ha caducado. Pide una versión actualizada.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sig) return setError("Firma en el recuadro");
              if (!ok) return setError("Debes aceptar las condiciones");
              start(async () => {
                const r = await acceptQuote({ token, name, signature: sig, accept: true });
                if (!r.ok) return setError(r.error ?? "No se pudo aceptar");
                setDone({ confirmed: Boolean(r.confirmed) });
              });
            }}
          >
            <h2 className="text-lg font-semibold">Aceptar presupuesto</h2>
            <Field label="Nombre y apellidos" htmlFor="pq-name">
              <Input id="pq-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <SignaturePad value={sig} onChange={setSig} />
            <label className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" checked={ok} onCheckedChange={(v) => setOk(v === true)} /> He leído y acepto el presupuesto y sus condiciones.
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button className="w-full" size="lg" disabled={pending}>Firmar y aceptar</Button>
          </form>
        )}
      </section>
    </div>
  );
}
