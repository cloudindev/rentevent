"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { ORDER_STATUS } from "@/components/app/order-status";
import { formatDate } from "@/lib/utils";
import { changeOrderStatus, type ShortageView } from "@/server/actions/orders";

const FLOW: Record<string, string[]> = {
  borrador: ["consulta", "opcion", "confirmado", "cancelado"],
  consulta: ["opcion", "confirmado", "cancelado", "borrador"],
  opcion: ["confirmado", "consulta", "cancelado"],
  confirmado: ["en_curso", "opcion", "cancelado"],
  en_curso: ["devuelto", "confirmado"],
  devuelto: ["en_curso"],
  cancelado: ["borrador", "consulta"],
};
const HINT: Record<string, string> = {
  consulta: "No reserva: se ve como demanda potencial",
  opcion: "Reserva provisional con caducidad",
  confirmado: "Reserva en firme (comprueba el stock con bloqueo)",
  en_curso: "Material en obra",
  devuelto: "Material de vuelta: libera stock",
  cancelado: "Libera todas las reservas",
  borrador: "Sin reservas",
};

export function StatusMenu({ orderId, status, canConfirm, canEdit, optionExpiresAt, dirty }: { orderId: string; status: string; canConfirm: boolean; canEdit: boolean; optionExpiresAt: string | null; dirty: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [conflict, setConflict] = useState<{ target: string; shortages: ShortageView[] } | null>(null);
  const s = ORDER_STATUS[status] ?? ORDER_STATUS.borrador!;
  const go = (target: string) =>
    start(async () => {
      if (dirty) {
        toast.message("Espera a que se guarden los cambios");
        return;
      }
      const r = await changeOrderStatus({ orderId, status: target as "confirmado" });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data.shortages.length) {
        setConflict({ target, shortages: r.data.shortages });
        return;
      }
      toast.success(`Pedido en estado ${ORDER_STATUS[target]?.label.toLowerCase()}`);
      router.refresh();
    });
  if (!canEdit)
    return <StatusPill tone={s.tone}>{s.label}</StatusPill>;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-1 rounded-full" disabled={pending} aria-label={`Estado: ${s.label}. Cambiar estado`}>
            <StatusPill tone={s.tone}>
              {s.label}
              {status === "opcion" && optionExpiresAt ? ` · hasta ${formatDate(optionExpiresAt, { day: "numeric", month: "short" })}` : ""}
            </StatusPill>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
          {(FLOW[status] ?? []).map((t) => (
            <DropdownMenuItem key={t} disabled={t === "confirmado" && !canConfirm} onSelect={() => go(t)} className="items-start">
              <span className={`mt-1.5 size-2 rounded-full`} style={{ background: `var(--${ORDER_STATUS[t]?.tone === "success" ? "success" : ORDER_STATUS[t]?.tone === "warning" ? "warning" : ORDER_STATUS[t]?.tone === "danger" ? "danger" : ORDER_STATUS[t]?.tone === "info" ? "info" : "muted-foreground"})` }} />
              <span>
                <span className="block">{ORDER_STATUS[t]?.label}</span>
                <span className="block text-xs text-muted-foreground">{HINT[t]}</span>
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <p className="px-2 py-1 text-[11px] text-muted-foreground">El material queda bloqueado desde la carga hasta el retorno.</p>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No se puede {conflict?.target === "confirmado" ? "confirmar" : "reservar"}: falta material</DialogTitle>
            <DialogDescription>Otro pedido ocupa estas unidades en las mismas fechas. Nada se ha reservado.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {conflict?.shortages.map((sh) => (
              <li key={sh.itemId} className="rounded-lg border p-3">
                <p className="flex items-center justify-between font-medium">
                  {sh.name} <StatusPill tone="danger">Faltan {sh.shortage}</StatusPill>
                </p>
                <p className="text-xs text-muted-foreground">
                  Necesitas {sh.requested}, libres {sh.available}. Lo ocupan: {sh.occupants.map((o) => `${o.projectName} (${o.quantity})`).join(", ")}
                </p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflict(null)}>Cerrar</Button>
            <Button onClick={() => { const t = conflict?.target; setConflict(null); if (t) go("consulta"); }}>Dejar como consulta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
