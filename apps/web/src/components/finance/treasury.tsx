"use client";
import { useMemo, useState } from "react";
import { Link2, Plus, Trash2, Undo2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { cn, formatDate, formatEUR } from "@/lib/utils";
import {
  createBankAccountAction,
  createMovementAction,
  deleteMovementAction,
  importMovementsAction,
  reconcileMovementAction,
  unreconcileMovementAction,
} from "@/server/actions/finance";
import { PURCHASE_CATEGORIES } from "./status";
import { useAction } from "./use-action";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

export function NewAccountDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", iban: "", openingBalance: 0, openingDate: today() });
  const { pending, run } = useAction();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> Cuenta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Nueva cuenta</DialogTitle>
            <DialogDescription>Cuenta bancaria o caja.</DialogDescription>
          </DialogHeader>
          <Field label="Nombre" htmlFor="ba-name">
            <Input id="ba-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="IBAN" htmlFor="ba-iban">
            <Input id="ba-iban" value={f.iban} onChange={(e) => setF({ ...f, iban: e.target.value.toUpperCase() })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Saldo inicial" htmlFor="ba-bal">
              <Input id="ba-bal" type="number" step="0.01" value={f.openingBalance} onChange={(e) => setF({ ...f, openingBalance: e.target.valueAsNumber || 0 })} />
            </Field>
            <Field label="A fecha" htmlFor="ba-date">
              <Input id="ba-date" type="date" value={f.openingDate} onChange={(e) => setF({ ...f, openingDate: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button disabled={pending || f.name.length < 2} onClick={() => run(() => createBankAccountAction({ ...f, openingDate: f.openingDate || null }), { success: "Cuenta creada", onOk: () => setOpen(false) })}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MovementButtons({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState<null | "new" | "import">(null);
  const [f, setF] = useState({ bookedOn: today(), concept: "", amount: 0, category: "", forecast: false });
  const [csv, setCsv] = useState("");
  const { pending, run } = useAction();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen("import")}>
        <Upload /> Importar extracto
      </Button>
      <Button size="sm" onClick={() => setOpen("new")}>
        <Plus /> Movimiento
      </Button>
      <Dialog open={open === "new"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
            <DialogDescription>Importe positivo para entradas y negativo para salidas. Con fecha futura cuenta como previsión.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" htmlFor="mv-date">
              <Input id="mv-date" type="date" value={f.bookedOn} onChange={(e) => setF({ ...f, bookedOn: e.target.value })} />
            </Field>
            <Field label="Importe" htmlFor="mv-amount">
              <Input id="mv-amount" type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.valueAsNumber || 0 })} />
            </Field>
          </div>
          <Field label="Concepto" htmlFor="mv-concept">
            <Input id="mv-concept" value={f.concept} onChange={(e) => setF({ ...f, concept: e.target.value })} />
          </Field>
          <Field label="Categoría" htmlFor="mv-cat">
            <NativeSelect id="mv-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option value="">Sin categoría</option>
              <option value="cobros">Cobros</option>
              {Object.entries(PURCHASE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
              <option value="impuestos">Impuestos</option>
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button disabled={pending || !f.amount || f.concept.length < 2} onClick={() => run(() => createMovementAction({ accountId, ...f, category: f.category || null }), { success: "Movimiento creado", onOk: () => setOpen(null) })}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={open === "import"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar extracto bancario</DialogTitle>
            <DialogDescription>CSV con columnas fecha;concepto;importe. Se ignoran la cabecera y los movimientos ya importados.</DialogDescription>
          </DialogHeader>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            aria-label="Archivo CSV"
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setCsv(await file.text());
            }}
          />
          <Textarea aria-label="Contenido CSV" value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} placeholder={"19/11/2026;Transferencia cliente;1.210,00\n20/11/2026;Gasóleo;-85,50"} className="font-mono text-xs" />
          <DialogFooter>
            <Button
              disabled={pending || !csv.trim()}
              onClick={() =>
                run(() => importMovementsAction({ accountId, csv }), {
                  onOk: (d) => {
                    toast.success(`${d.imported} movimientos importados${d.duplicates ? ` · ${d.duplicates} duplicados ignorados` : ""}`);
                    if (d.errors.length) toast.warning(d.errors.slice(0, 3).join(" · "));
                    setCsv("");
                    setOpen(null);
                  },
                })
              }
            >
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Candidates = {
  invoices: { id: string; fullNumber: string | null; outstanding: number; clientName: string | null; dueDate: string | null }[];
  purchases: { id: string; concept: string; total: number; supplierName: string | null; issueDate: string }[];
};

export function MovementRowActions({
  movement,
  candidates,
}: {
  movement: { id: string; amount: number; concept: string; reconciled: boolean; invoiceId: string | null; forecast: boolean };
  candidates: Candidates;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("general");
  const { pending, run } = useAction();
  const income = movement.amount > 0;
  const ranked = useMemo(() => {
    const amt = Math.abs(movement.amount);
    const words = movement.concept.toLowerCase();
    const score = (value: number, label: string) => (Math.abs(value - amt) < 0.01 ? 0 : 1) + (label && words.includes(label.toLowerCase()) ? -0.5 : 0) + Math.abs(value - amt) / Math.max(amt, 1);
    return income
      ? [...candidates.invoices].sort((a, b) => score(a.outstanding, a.fullNumber ?? "") - score(b.outstanding, b.fullNumber ?? ""))
      : [...candidates.purchases].sort((a, b) => score(Number(a.total), a.concept) - score(Number(b.total), b.concept));
  }, [candidates, income, movement]);

  if (movement.forecast)
    return (
      <Button variant="ghost" size="icon-sm" aria-label="Borrar previsión" disabled={pending} onClick={() => run(() => deleteMovementAction({ id: movement.id }), { success: "Previsión borrada" })}>
        <Trash2 />
      </Button>
    );
  if (movement.reconciled)
    return movement.invoiceId ? null : (
      <Button variant="ghost" size="icon-sm" aria-label="Deshacer conciliación" disabled={pending} onClick={() => run(() => unreconcileMovementAction({ movementId: movement.id }), { success: "Conciliación deshecha" })}>
        <Undo2 />
      </Button>
    );
  return (
    <div className="flex justify-end gap-1">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Link2 /> Conciliar
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Borrar movimiento" disabled={pending} onClick={() => confirm("¿Borrar este movimiento?") && run(() => deleteMovementAction({ id: movement.id }), { success: "Movimiento borrado" })}>
        <Trash2 />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Conciliar movimiento</DialogTitle>
            <DialogDescription>
              {movement.concept} · <strong className={cn(income ? "text-success" : "text-foreground")}>{formatEUR(movement.amount)}</strong>
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="match">
            <TabsList>
              <TabsTrigger value="match">{income ? "Con un cobro de factura" : "Con una compra"}</TabsTrigger>
              <TabsTrigger value="cat">Solo categorizar</TabsTrigger>
            </TabsList>
            <TabsContent value="match" className="pt-3">
              {ranked.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{income ? "No hay facturas pendientes de cobro." : "No hay compras pendientes de pago."}</p>
              ) : (
                <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border">
                  {ranked.slice(0, 30).map((c) => {
                    const isInv = "fullNumber" in c;
                    const value = isInv ? c.outstanding : Number(c.total);
                    const exact = Math.abs(value - Math.abs(movement.amount)) < 0.01;
                    return (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{isInv ? c.fullNumber : c.concept}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {isInv ? `${c.clientName ?? "—"} · vence ${c.dueDate ? formatDate(c.dueDate) : "—"}` : `${c.supplierName ?? "—"} · ${formatDate(c.issueDate)}`}
                          </p>
                        </div>
                        <span className={cn("tabular", exact && "font-semibold text-success")}>{formatEUR(value)}</span>
                        <Button
                          size="sm"
                          variant={exact ? "default" : "outline"}
                          disabled={pending}
                          onClick={() => run(() => reconcileMovementAction({ movementId: movement.id, target: { type: isInv ? "invoice" : "purchase", id: c.id } }), { success: "Movimiento conciliado", onOk: () => setOpen(false) })}
                        >
                          Asignar
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {income && <p className="mt-2 text-xs text-muted-foreground">Al asignar se registra el cobro en la factura por el importe del movimiento.</p>}
            </TabsContent>
            <TabsContent value="cat" className="space-y-3 pt-3">
              <Field label="Categoría" htmlFor="rc-cat">
                <NativeSelect id="rc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {Object.entries(PURCHASE_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                  <option value="impuestos">Impuestos</option>
                  <option value="comisiones">Comisiones bancarias</option>
                  <option value="traspasos">Traspasos</option>
                </NativeSelect>
              </Field>
              <DialogFooter>
                <Button disabled={pending} onClick={() => run(() => reconcileMovementAction({ movementId: movement.id, target: { type: "none", category } }), { success: "Movimiento conciliado", onOk: () => setOpen(false) })}>
                  Marcar como conciliado
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
