"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Download, FileCode2, FileText, Mail, MoreHorizontal, Undo2, Wallet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Checkbox } from "@/components/ui/menu";
import { formatEUR } from "@/lib/utils";
import {
  createRectificationAction,
  deleteDraftInvoiceAction,
  issueInvoiceAction,
  registerPaymentAction,
  sendInvoiceEmailAction,
} from "@/server/actions/finance";
import { PAYMENT_METHODS } from "./status";
import { useAction } from "./use-action";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

export function InvoiceActions({
  invoice,
  accounts,
}: {
  invoice: { id: string; fullNumber: string | null; status: string; kind: string; total: number; paid: number; clientEmail: string | null; rectified: boolean };
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [dialog, setDialog] = useState<null | "issue" | "pay" | "rect" | "mail" | "delete">(null);
  const outstanding = Math.round((invoice.total - invoice.paid) * 100) / 100;
  const [pay, setPay] = useState({ amount: outstanding, paidOn: today(), method: "transferencia" as const, bankAccountId: accounts[0]?.id ?? "", reference: "", createMovement: true });
  const [reason, setReason] = useState("");
  const [mail, setMail] = useState({ to: invoice.clientEmail ?? "", message: "" });
  const close = () => setDialog(null);
  const draft = !invoice.fullNumber;

  return (
    <>
      {draft ? (
        <>
          <Button asChild variant="outline" size="sm">
            <a href={`/app/ventas/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <FileText /> Vista previa
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDialog("delete")}>
            <Trash2 /> Borrar
          </Button>
          <Button size="sm" onClick={() => setDialog("issue")}>
            <BadgeCheck /> Emitir
          </Button>
        </>
      ) : (
        <>
          <Button asChild variant="outline" size="sm">
            <a href={`/app/ventas/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <FileText /> PDF
            </a>
          </Button>
          {outstanding > 0.005 && invoice.status !== "anulada" && (
            <Button size="sm" onClick={() => setDialog("pay")}>
              <Wallet /> Registrar cobro
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Más acciones">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setDialog("mail")}>
                <Mail /> Enviar por correo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open(`/app/ventas/${invoice.id}/pdf?descargar=1`, "_blank")}>
                <Download /> Descargar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open(`/app/ventas/${invoice.id}/xml`, "_self")}>
                <FileCode2 /> Descargar XML (factura electrónica)
              </DropdownMenuItem>
              {invoice.kind !== "rectificativa" && !invoice.rectified && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDialog("rect")}>
                    <Undo2 /> Rectificar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      <Dialog open={dialog === "issue"} onOpenChange={(o) => !o && close()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Emitir factura</DialogTitle>
            <DialogDescription>Se asignará el siguiente número de la serie y la fecha de hoy. Una vez emitida no se puede modificar: los cambios se hacen con una rectificativa.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button disabled={pending} onClick={() => run(() => issueInvoiceAction({ invoiceId: invoice.id }), { onOk: (d) => (close(), router.refresh(), void d), success: "Factura emitida" })}>
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && close()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Borrar borrador</DialogTitle>
            <DialogDescription>El borrador no tiene número, así que se puede borrar sin romper la numeración.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => run(() => deleteDraftInvoiceAction({ invoiceId: invoice.id }), { success: "Borrador eliminado", onOk: () => router.push("/app/ventas") })}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "pay"} onOpenChange={(o) => !o && close()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>Pendiente: {formatEUR(outstanding)}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importe" htmlFor="p-amount">
              <Input id="p-amount" type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.valueAsNumber || 0 })} />
            </Field>
            <Field label="Fecha" htmlFor="p-date">
              <Input id="p-date" type="date" value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} />
            </Field>
          </div>
          <Field label="Forma de pago" htmlFor="p-method">
            <NativeSelect id="p-method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as typeof pay.method })}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Cuenta" htmlFor="p-acc">
            <NativeSelect id="p-acc" value={pay.bankAccountId} onChange={(e) => setPay({ ...pay, bankAccountId: e.target.value })}>
              <option value="">Sin cuenta (caja)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Referencia" htmlFor="p-ref">
            <Input id="p-ref" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
          </Field>
          {pay.bankAccountId && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={pay.createMovement} onCheckedChange={(v) => setPay({ ...pay, createMovement: v === true })} /> Crear el movimiento bancario conciliado
            </label>
          )}
          <DialogFooter>
            <Button
              disabled={pending || !pay.amount}
              onClick={() => run(() => registerPaymentAction({ invoiceId: invoice.id, ...pay, bankAccountId: pay.bankAccountId || null, reference: pay.reference || null }), { success: "Cobro registrado", onOk: close })}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "rect"} onOpenChange={(o) => !o && close()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Rectificar {invoice.fullNumber}</DialogTitle>
            <DialogDescription>Se crea un borrador de rectificativa en la serie R por el importe total en negativo. Puedes ajustar las líneas antes de emitirla.</DialogDescription>
          </DialogHeader>
          <Field label="Motivo" htmlFor="r-reason">
            <Textarea id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Error en el NIF del cliente, devolución parcial…" />
          </Field>
          <DialogFooter>
            <Button disabled={pending || reason.trim().length < 3} onClick={() => run(() => createRectificationAction({ invoiceId: invoice.id, reason }), { onOk: (d) => router.push(`/app/ventas/${d.id}`) })}>
              Crear rectificativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "mail"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar {invoice.fullNumber}</DialogTitle>
            <DialogDescription>Se adjunta el PDF de la factura.</DialogDescription>
          </DialogHeader>
          <Field label="Para" htmlFor="m-to">
            <Input id="m-to" type="email" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} />
          </Field>
          <Field label="Mensaje" htmlFor="m-msg" hint="Vacío: mensaje estándar">
            <Textarea id="m-msg" value={mail.message} onChange={(e) => setMail({ ...mail, message: e.target.value })} rows={5} />
          </Field>
          <DialogFooter>
            <Button disabled={pending || !mail.to} onClick={() => run(() => sendInvoiceEmailAction({ invoiceId: invoice.id, ...mail }), { success: "Factura enviada", onOk: close })}>
              <Mail /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
