"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { formatDate, formatEUR } from "@/lib/utils";
import { deletePurchaseAction, payPurchaseAction, savePurchaseAction } from "@/server/actions/finance";
import { PURCHASE_CATEGORIES } from "./status";
import { useAction } from "./use-action";

export type PurchaseOptions = {
  suppliers: { id: string; name: string }[];
  projects: { id: string; name: string; number: string }[];
  subrentals: { id: string; projectId: string | null; supplierId: string | null; cost: number; notes: string | null; startsAt: Date | string }[];
  accounts: { id: string; name: string }[];
};

export type PurchaseCategory = "general" | "subalquiler" | "mantenimiento" | "transporte" | "personal" | "material" | "seguros" | "suministros";

export type PurchaseValue = {
  id: string | null;
  kind: "factura" | "gasto" | "ticket";
  supplierId: string;
  projectId: string;
  subrentalId: string;
  number: string;
  issueDate: string;
  dueDate: string;
  concept: string;
  category: PurchaseCategory;
  base: number;
  vatRate: number;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
const blank = (): PurchaseValue => ({ id: null, kind: "factura", supplierId: "", projectId: "", subrentalId: "", number: "", issueDate: today(), dueDate: "", concept: "", category: "general", base: 0, vatRate: 21 });

export function PurchaseDialog({ options, value, trigger }: { options: PurchaseOptions; value?: PurchaseValue; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<PurchaseValue>(value ?? blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { pending, run } = useAction();
  const subs = useMemo(() => options.subrentals.filter((s) => !f.supplierId || s.supplierId === f.supplierId), [options.subrentals, f.supplierId]);
  const set = <K extends keyof PurchaseValue>(k: K, v: PurchaseValue[K]) => setF((x) => ({ ...x, [k]: v }));
  const total = Math.round(f.base * (1 + f.vatRate / 100) * 100) / 100;
  return (
    <>
      <span onClick={() => (setF(value ?? blank()), setOpen(true))}>
        {trigger ?? (
          <Button size="sm">
            <Plus /> Nueva compra
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{f.id ? "Editar compra" : "Nueva compra o gasto"}</DialogTitle>
            <DialogDescription>Imputa el coste a un proyecto para verlo en su rentabilidad.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tipo" htmlFor="pu-kind">
              <NativeSelect id="pu-kind" value={f.kind} onChange={(e) => set("kind", e.target.value as PurchaseValue["kind"])}>
                <option value="factura">Factura de proveedor</option>
                <option value="gasto">Gasto</option>
                <option value="ticket">Ticket</option>
              </NativeSelect>
            </Field>
            <Field label="Proveedor" htmlFor="pu-sup" className="sm:col-span-2">
              <NativeSelect id="pu-sup" value={f.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                <option value="">Sin proveedor</option>
                {options.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Concepto" htmlFor="pu-concept" className="sm:col-span-2" error={errors.concept}>
              <Input id="pu-concept" value={f.concept} onChange={(e) => set("concept", e.target.value)} />
            </Field>
            <Field label="Nº factura" htmlFor="pu-num">
              <Input id="pu-num" value={f.number} onChange={(e) => set("number", e.target.value)} />
            </Field>
            <Field label="Fecha" htmlFor="pu-date">
              <Input id="pu-date" type="date" value={f.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
            </Field>
            <Field label="Vencimiento" htmlFor="pu-due">
              <Input id="pu-due" type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </Field>
            <Field label="Categoría" htmlFor="pu-cat">
              <NativeSelect id="pu-cat" value={f.subrentalId ? "subalquiler" : f.category} disabled={Boolean(f.subrentalId)} onChange={(e) => set("category", e.target.value as PurchaseValue["category"])}>
                {Object.entries(PURCHASE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Proyecto" htmlFor="pu-proj" className="sm:col-span-2">
              <NativeSelect id="pu-proj" value={f.projectId} onChange={(e) => set("projectId", e.target.value)}>
                <option value="">Sin imputar</option>
                {options.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} · {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Subalquiler" htmlFor="pu-sub" hint="Fija el coste real del subalquiler" className="sm:col-span-3">
              <NativeSelect
                id="pu-sub"
                value={f.subrentalId}
                onChange={(e) => {
                  const s = options.subrentals.find((x) => x.id === e.target.value);
                  setF((x) => ({ ...x, subrentalId: e.target.value, projectId: s?.projectId ?? x.projectId, supplierId: s?.supplierId ?? x.supplierId, base: x.base || Number(s?.cost ?? 0), category: s ? "subalquiler" : x.category }));
                }}
              >
                <option value="">No es un subalquiler</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatDate(s.startsAt)} · {s.notes ?? "Subalquiler"} · {formatEUR(Number(s.cost))}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Base imponible" htmlFor="pu-base" error={errors.base}>
              <Input id="pu-base" type="number" step="0.01" value={f.base} onChange={(e) => set("base", e.target.valueAsNumber || 0)} />
            </Field>
            <Field label="IVA" htmlFor="pu-vat">
              <NativeSelect id="pu-vat" value={f.vatRate} onChange={(e) => set("vatRate", Number(e.target.value))}>
                {[...new Set([21, 10, 4, 0, f.vatRate])].sort((a, b) => b - a).map((v) => (
                  <option key={v} value={v}>
                    {v} %
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid content-end pb-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tabular">{formatEUR(total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    savePurchaseAction({
                      ...f,
                      supplierId: f.supplierId || null,
                      projectId: f.projectId || null,
                      subrentalId: f.subrentalId || null,
                      number: f.number || null,
                      dueDate: f.dueDate || null,
                    }),
                  { success: "Compra guardada", onOk: () => setOpen(false), onError: (r) => setErrors(r.fieldErrors ?? {}) },
                )
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PurchaseRowActions({ value, status, total, options }: { value: PurchaseValue; status: string; total: number; options: PurchaseOptions }) {
  const [payOpen, setPayOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(today());
  const [account, setAccount] = useState(options.accounts[0]?.id ?? "");
  const { pending, run } = useAction();
  return (
    <div className="flex items-center justify-end gap-1">
      {status !== "pagada" && (
        <Button variant="outline" size="sm" onClick={() => setPayOpen(true)}>
          <Wallet /> Pagar
        </Button>
      )}
      <PurchaseDialog
        options={options}
        value={value}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Editar compra">
            <Pencil />
          </Button>
        }
      />
      {status !== "pagada" && (
        <Button variant="ghost" size="icon-sm" aria-label="Borrar compra" disabled={pending} onClick={() => confirm("¿Borrar esta compra?") && run(() => deletePurchaseAction({ id: value.id! }), { success: "Compra borrada" })}>
          <Trash2 />
        </Button>
      )}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>{formatEUR(total)} · se crea el movimiento bancario conciliado.</DialogDescription>
          </DialogHeader>
          <Field label="Fecha de pago" htmlFor="pp-date">
            <Input id="pp-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <Field label="Cuenta" htmlFor="pp-acc">
            <NativeSelect id="pp-acc" value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="">Sin cuenta (caja)</option>
              {options.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button disabled={pending} onClick={() => run(() => payPurchaseAction({ id: value.id!, paidOn, bankAccountId: account || null, movementId: null }), { success: "Pago registrado", onOk: () => setPayOpen(false) })}>
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
