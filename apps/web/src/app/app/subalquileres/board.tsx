"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeftRight, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { StatusPill, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/menu";
import { formatEUR, formatRange, toLocalInput } from "@/lib/utils";
import { purchaseFromSubrental, saveSubrental, setSubrentalStatus } from "@/server/actions/subrentals";
import { fromLocalInput } from "../pedidos/[id]/header-sheet";

type Row = { id: string; supplierId: string | null; supplier: string; itemId: string; item: string; orderId: string | null; order: string | null; quantity: number; received: number; startsAt: string; endsAt: string; cost: number; status: string; notes: string | null; purchaseId: string | null };
const STATUS: Record<string, { label: string; tone: Tone }> = {
  solicitado: { label: "Solicitado", tone: "warning" },
  confirmado: { label: "Confirmado", tone: "info" },
  recibido: { label: "Recibido", tone: "success" },
  devuelto: { label: "Devuelto", tone: "neutral" },
  cancelado: { label: "Cancelado", tone: "danger" },
};
const NEXT: Record<string, string[]> = { solicitado: ["confirmado", "cancelado"], confirmado: ["recibido", "cancelado"], recibido: ["devuelto"], devuelto: [], cancelado: ["solicitado"] };

export function SubrentalsBoard({ rows, suppliers, items, orders, canEdit, canFinance }: { rows: Row[]; suppliers: { id: string; name: string }[]; items: { id: string; name: string }[]; orders: { id: string; label: string; s: string; e: string }[]; canEdit: boolean; canFinance: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const totals = { pendiente: rows.filter((r) => r.status === "solicitado").length, coste: rows.filter((r) => r.status !== "cancelado").reduce((s, r) => s + r.cost, 0) };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone="warning">{totals.pendiente} por confirmar con el proveedor</StatusPill>
        <span className="text-sm text-muted-foreground">Coste total {formatEUR(totals.coste)}</span>
        <span className="text-xs text-muted-foreground">Solo los confirmados o recibidos suman stock en la disponibilidad.</span>
        {canEdit && <Button className="ml-auto" size="sm" onClick={() => setEdit({ quantity: 1, cost: 0, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })}><Plus /> Nuevo subalquiler</Button>}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Sin subalquileres" description="Cuando falte material en un pedido podrás subalquilarlo desde la propia línea o crearlo aquí." />
      ) : (
        <Table>
          <THead>
            <TR><TH>Artículo</TH><TH className="text-right">Cantidad</TH><TH>Proveedor</TH><TH>Fechas</TH><TH>Pedido</TH><TH className="text-right">Coste</TH><TH>Estado</TH><TH /></TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD><button className="text-left font-medium hover:underline" onClick={() => canEdit && setEdit(r)}>{r.item}</button></TD>
                <TD className="tabular text-right">{r.quantity}{r.status === "recibido" && r.received !== r.quantity ? ` (${r.received} recibidas)` : ""}</TD>
                <TD>{r.supplier}</TD>
                <TD className="whitespace-nowrap">{formatRange(r.startsAt, r.endsAt)}</TD>
                <TD>{r.orderId ? <Link className="hover:underline" href={`/app/pedidos/${r.orderId}`}>{r.order}</Link> : "—"}</TD>
                <TD className="tabular text-right">{formatEUR(r.cost)}</TD>
                <TD><StatusPill tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</StatusPill></TD>
                <TD className="text-right">
                  {canEdit && (NEXT[r.status]?.length ?? 0) > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="sm" variant="outline">Estado</Button></DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {NEXT[r.status]!.map((s) => (
                          <DropdownMenuItem key={s} onSelect={() => start(async () => { const x = await setSubrentalStatus({ id: r.id, status: s as "confirmado" }); if (!x.ok) toast.error(x.error); router.refresh(); })}>{STATUS[s]?.label}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {canFinance && r.status !== "cancelado" && (r.purchaseId ? <Button asChild size="sm" variant="ghost"><Link href={`/app/compras?id=${r.purchaseId}`}><Receipt /> Factura</Link></Button> : <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const x = await purchaseFromSubrental({ id: r.id }); if (x.ok) toast.success("Factura de proveedor registrada en Compras"); else toast.error(x.error); router.refresh(); })}><Receipt /> Registrar factura</Button>)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Editar subalquiler" : "Nuevo subalquiler"}>
        {edit && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              start(async () => {
                const r = await saveSubrental({ id: edit.id ?? null, supplierId: String(f.get("supplier")) || null, itemId: String(f.get("item")), orderId: String(f.get("order")) || null, quantity: Number(f.get("qty")), startsAt: fromLocalInput(String(f.get("s"))), endsAt: fromLocalInput(String(f.get("e"))), cost: Number(f.get("cost")), notes: String(f.get("notes") || "") || null });
                if (!r.ok) { setErrors(r.fieldErrors ?? {}); toast.error(r.error); return; }
                setEdit(null);
                router.refresh();
              });
            }}
          >
            <Field label="Artículo" htmlFor="sr-item" error={errors.itemId}><NativeSelect id="sr-item" name="item" defaultValue={edit.itemId ?? ""}><option value="">Elige…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
            <Field label="Proveedor" htmlFor="sr-sup"><NativeSelect id="sr-sup" name="supplier" defaultValue={edit.supplierId ?? ""}><option value="">Sin proveedor</option>{suppliers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</NativeSelect></Field>
            <Field label="Pedido" htmlFor="sr-order"><NativeSelect id="sr-order" name="order" defaultValue={edit.orderId ?? ""}><option value="">Sin pedido</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</NativeSelect></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad" htmlFor="sr-qty" error={errors.quantity}><Input id="sr-qty" name="qty" type="number" min={1} defaultValue={edit.quantity} /></Field>
              <Field label="Coste (€)" htmlFor="sr-cost"><Input id="sr-cost" name="cost" type="number" min={0} step="0.01" defaultValue={edit.cost} /></Field>
              <Field label="Recepción" htmlFor="sr-s"><Input id="sr-s" name="s" type="datetime-local" defaultValue={toLocalInput(edit.startsAt)} /></Field>
              <Field label="Devolución" htmlFor="sr-e" error={errors.endsAt}><Input id="sr-e" name="e" type="datetime-local" defaultValue={toLocalInput(edit.endsAt)} /></Field>
            </div>
            <Field label="Notas" htmlFor="sr-n"><Textarea id="sr-n" name="notes" defaultValue={edit.notes ?? ""} /></Field>
            <Button disabled={pending}>Guardar</Button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
