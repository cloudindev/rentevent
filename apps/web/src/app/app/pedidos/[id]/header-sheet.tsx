"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { toLocalInput } from "@/lib/utils";
import { zonedTime } from "@rentevent/core";
import type { OrderWorkspaceData } from "@/server/orders";
import { updateOrderHeader } from "@/server/actions/orders";

/** datetime-local (Europe/Madrid wall clock) → ISO */
export function fromLocalInput(v: string): string {
  const [d, t] = v.split("T");
  const [y, m, day] = d!.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  return new Date(zonedTime(y!, m!, day!, hh!, mm!)).toISOString();
}

export function HeaderSheet({ open, onOpenChange, order, clients, venues }: { open: boolean; onOpenChange: (o: boolean) => void; order: OrderWorkspaceData["order"]; clients: OrderWorkspaceData["clients"]; venues: OrderWorkspaceData["venues"] }) {
  const router = useRouter();
  const [v, setV] = useState({
    title: order.title,
    clientId: order.clientId ?? "",
    venueId: order.venueId ?? "",
    periodStart: toLocalInput(order.periodStart),
    eventStart: toLocalInput(order.eventStart ?? order.periodStart),
    eventEnd: toLocalInput(order.eventEnd ?? order.periodEnd),
    periodEnd: toLocalInput(order.periodEnd),
    discountPct: order.discountPct,
    holiday: order.holiday,
    trips: order.trips,
    notes: order.notes ?? "",
    distanceKm: order.distanceKm != null ? Math.round(order.distanceKm) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Datos del pedido" description="Las fechas de carga y retorno definen el bloqueo del material.">
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateOrderHeader({
              orderId: order.id,
              title: v.title,
              clientId: v.clientId || null,
              venueId: v.venueId || null,
              periodStart: fromLocalInput(v.periodStart),
              eventStart: fromLocalInput(v.eventStart),
              eventEnd: fromLocalInput(v.eventEnd),
              periodEnd: fromLocalInput(v.periodEnd),
              discountPct: Number(v.discountPct),
              holiday: v.holiday,
              trips: Number(v.trips),
              notes: v.notes || null,
              distanceKm: v.distanceKm === "" ? null : Number(v.distanceKm),
            });
            if (!r.ok) {
              setError(r.fieldErrors ? Object.values(r.fieldErrors)[0] ?? r.error : r.error);
              return;
            }
            toast.success("Pedido actualizado");
            onOpenChange(false);
            router.refresh();
          });
        }}
      >
        <Field label="Título" htmlFor="h-title" className="col-span-2">
          <Input id="h-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Cliente" htmlFor="h-client" className="col-span-2">
          <NativeSelect id="h-client" value={v.clientId} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setV({ ...v, clientId: e.target.value, discountPct: c?.discountPct ?? v.discountPct }); }}>
            <option value="">Sin cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Lugar" htmlFor="h-venue" className="col-span-2">
          <NativeSelect id="h-venue" value={v.venueId} onChange={(e) => setV({ ...v, venueId: e.target.value })}>
            <option value="">Sin lugar</option>
            {venues.map((x) => <option key={x.id} value={x.id}>{x.name}{x.anchoringAllowed ? "" : " · sin anclaje"}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Carga (inicio del bloqueo)" htmlFor="h-ps"><Input id="h-ps" type="datetime-local" value={v.periodStart} onChange={(e) => setV({ ...v, periodStart: e.target.value })} /></Field>
        <Field label="Retorno (fin del bloqueo)" htmlFor="h-pe"><Input id="h-pe" type="datetime-local" value={v.periodEnd} onChange={(e) => setV({ ...v, periodEnd: e.target.value })} /></Field>
        <Field label="Inicio del evento" htmlFor="h-es"><Input id="h-es" type="datetime-local" value={v.eventStart} onChange={(e) => setV({ ...v, eventStart: e.target.value })} /></Field>
        <Field label="Fin del evento" htmlFor="h-ee"><Input id="h-ee" type="datetime-local" value={v.eventEnd} onChange={(e) => setV({ ...v, eventEnd: e.target.value })} /></Field>
        <Field label="Descuento cliente %" htmlFor="h-disc"><Input id="h-disc" type="number" min={0} max={100} value={v.discountPct} onChange={(e) => setV({ ...v, discountPct: Number(e.target.value) })} /></Field>
        <Field label="Distancia (km)" htmlFor="h-km" hint="Calculada con la dirección; puedes corregirla"><Input id="h-km" type="number" min={0} value={v.distanceKm} onChange={(e) => setV({ ...v, distanceKm: e.target.value === "" ? "" : Number(e.target.value) })} /></Field>
        <Field label="Viajes" htmlFor="h-trips"><Input id="h-trips" type="number" min={1} value={v.trips} onChange={(e) => setV({ ...v, trips: Number(e.target.value) })} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={v.holiday} onCheckedChange={(x) => setV({ ...v, holiday: x })} /> Festivo</label>
        <Field label="Notas" htmlFor="h-notes" className="col-span-2"><Textarea id="h-notes" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
        {error && <p role="alert" className="col-span-2 text-sm text-danger">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Sheet>
  );
}
