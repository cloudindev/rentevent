"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { formatEUR } from "@/lib/utils";
import { invoiceTotals, lineNet, type InvoiceLine } from "@/server/finance/calc";
import { updateDraftInvoiceAction } from "@/server/actions/finance";
import { useAction } from "./use-action";

const VAT = [21, 10, 4, 0];

export function InvoiceEditor({
  invoiceId,
  clients,
  initial,
}: {
  invoiceId: string;
  clients: { id: string; name: string; taxId: string | null }[];
  initial: { clientId: string | null; lines: InvoiceLine[]; notes: string | null; dueDate: string | null };
}) {
  const [clientId, setClientId] = useState(initial.clientId ?? "");
  const [lines, setLines] = useState<InvoiceLine[]>(initial.lines.length ? initial.lines : [{ description: "", quantity: 1, unitPrice: 0, discountPct: 0, taxRate: 21 }]);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [dirty, setDirty] = useState(false);
  const { pending, run } = useAction();
  const totals = useMemo(() => invoiceTotals(lines.map((l) => ({ ...l, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 }))), [lines]);

  const update = (i: number, patch: Partial<InvoiceLine>) => {
    setDirty(true);
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  };
  const save = () =>
    run(() => updateDraftInvoiceAction({ invoiceId, clientId: clientId || null, lines, notes, dueDate: dueDate || null }), { success: "Borrador guardado", onOk: () => setDirty(false) });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Field label="Cliente" htmlFor="ie-client">
          <NativeSelect
            id="ie-client"
            value={clientId}
            onChange={(e) => {
              setDirty(true);
              setClientId(e.target.value);
            }}
          >
            <option value="">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.taxId ? ` · ${c.taxId}` : " · sin NIF"}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vencimiento" htmlFor="ie-due" hint="Vacío: según condiciones del cliente">
          <Input
            id="ie-due"
            type="date"
            value={dueDate}
            onChange={(e) => {
              setDirty(true);
              setDueDate(e.target.value);
            }}
          />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-[13px] text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-normal">Concepto</th>
              <th className="w-24 px-2 py-2 text-right font-normal">Cant.</th>
              <th className="w-32 px-2 py-2 text-right font-normal">Precio</th>
              <th className="w-20 px-2 py-2 text-right font-normal">Dto. %</th>
              <th className="w-24 px-2 py-2 text-right font-normal">IVA</th>
              <th className="w-28 px-3 py-2 text-right font-normal">Importe</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-2 py-1.5">
                  <Input aria-label={`Concepto línea ${i + 1}`} value={l.description} onChange={(e) => update(i, { description: e.target.value })} className="border-transparent hover:border-input" />
                </td>
                <td className="px-1 py-1.5">
                  <Input aria-label="Cantidad" type="number" step="any" value={l.quantity} onChange={(e) => update(i, { quantity: e.target.valueAsNumber || 0 })} className="text-right tabular" />
                </td>
                <td className="px-1 py-1.5">
                  <Input aria-label="Precio" type="number" step="0.01" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.valueAsNumber || 0 })} className="text-right tabular" />
                </td>
                <td className="px-1 py-1.5">
                  <Input aria-label="Descuento" type="number" min={0} max={100} value={l.discountPct ?? 0} onChange={(e) => update(i, { discountPct: e.target.valueAsNumber || 0 })} className="text-right tabular" />
                </td>
                <td className="px-1 py-1.5">
                  <NativeSelect aria-label="IVA" value={l.taxRate} onChange={(e) => update(i, { taxRate: Number(e.target.value) })}>
                    {VAT.map((v) => (
                      <option key={v} value={v}>
                        {v} %
                      </option>
                    ))}
                  </NativeSelect>
                </td>
                <td className="px-3 py-1.5 text-right tabular">{formatEUR(lineNet({ ...l, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 }))}</td>
                <td className="pr-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar línea"
                    disabled={lines.length === 1}
                    onClick={() => {
                      setDirty(true);
                      setLines((ls) => ls.filter((_, j) => j !== i));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDirty(true);
            setLines((ls) => [...ls, { description: "", quantity: 1, unitPrice: 0, discountPct: 0, taxRate: 21 }]);
          }}
        >
          <Plus /> Añadir línea
        </Button>
        <Totals totals={totals} />
      </div>
      <Field label="Notas en la factura" htmlFor="ie-notes">
        <Textarea
          id="ie-notes"
          value={notes}
          onChange={(e) => {
            setDirty(true);
            setNotes(e.target.value);
          }}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || !dirty}>
          Guardar borrador
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
      </div>
    </div>
  );
}

export function Totals({ totals, paid }: { totals: { subtotal: number; vat: number; total: number; breakdown: { rate: number; base: number; amount: number }[] }; paid?: number }) {
  return (
    <dl className="w-full max-w-xs space-y-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Base imponible</dt>
        <dd className="tabular">{formatEUR(totals.subtotal)}</dd>
      </div>
      {totals.breakdown.map((b) => (
        <div key={b.rate} className="flex justify-between">
          <dt className="text-muted-foreground">IVA {b.rate} %</dt>
          <dd className="tabular">{formatEUR(b.amount)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular">{formatEUR(totals.total)}</dd>
      </div>
      {paid !== undefined && (
        <>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cobrado</dt>
            <dd className="tabular">{formatEUR(paid)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Pendiente</dt>
            <dd className="tabular">{formatEUR(Math.max(0, totals.total - paid))}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
