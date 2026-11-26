"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Copy, ExternalLink, FileText, Receipt, Send, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatDate, formatEUR } from "@/lib/utils";
import type { TentViewerApi } from "@/components/tent3d";
import type { OrderWorkspaceData } from "@/server/orders";
import { createQuote, duplicateOrder, rejectQuote, sendQuote } from "@/server/actions/orders";
import { createInvoiceFromOrderAction } from "@/server/actions/finance";

const QUOTE_STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  borrador: { label: "Borrador", tone: "neutral" },
  enviado: { label: "Enviado", tone: "info" },
  aceptado: { label: "Aceptado", tone: "success" },
  rechazado: { label: "Rechazado", tone: "danger" },
  sustituido: { label: "Sustituido", tone: "neutral" },
};

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(b);
  });
}

export function QuotePanel({ orderId, quotes, clientEmail, canEdit, canInvoice, dirty, viewerApi, hasTent, depositPct }: { depositPct: number; orderId: string; quotes: OrderWorkspaceData["quotes"]; clientEmail: string | null; canEdit: boolean; canInvoice: boolean; dirty: boolean; viewerApi: React.RefObject<TentViewerApi | null>; hasTent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [send, setSend] = useState<{ id: string; number: string } | null>(null);
  const [to, setTo] = useState(clientEmail ?? "");
  const [msg, setMsg] = useState("Hola,\n\nTe enviamos el presupuesto. En el enlace puedes ver la carpa en 3D y aceptarlo con tu firma.\n\nUn saludo.");

  const generate = () =>
    start(async () => {
      if (dirty) {
        toast.message("Espera a que se guarden los cambios");
        return;
      }
      let png: string | null = null;
      if (hasTent && viewerApi.current) {
        try {
          png = await blobToDataUrl(await viewerApi.current.toPNG());
        } catch {
          png = null;
        }
      }
      const r = await createQuote({ orderId, imagePng: png });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Presupuesto versión ${r.data.version} creado`);
      router.refresh();
    });

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Presupuestos</h3>
        {canEdit && (
          <Button size="sm" onClick={generate} disabled={pending}>
            <FileText /> Generar
          </Button>
        )}
      </div>
      {hasTent && canEdit && <p className="mb-2 text-xs text-muted-foreground">Abre el configurador antes de generar para incluir la imagen 3D.</p>}
      {quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay presupuestos. Se guarda una versión cada vez que lo generas.</p>
      ) : (
        <ul className="divide-y text-sm">
          {quotes.map((q) => {
            // only the newest version can be accepted by the client; older open ones are superseded
            const latest = q.version === Math.max(...quotes.map((x) => x.version));
            const status = !latest && (q.status === "borrador" || q.status === "enviado") ? "sustituido" : q.status;
            const st = QUOTE_STATUS[status] ?? { label: status, tone: "neutral" as const };
            return (
            <li key={q.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-medium">v{q.version} · {q.number}</span>
                <StatusPill tone={st.tone}>{st.label}</StatusPill>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatEUR(q.total)} · {formatDate(q.createdAt)}
                {q.acceptedAt ? ` · aceptado ${formatDate(q.acceptedAt)}` : q.sentAt ? ` · enviado ${formatDate(q.sentAt)}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Button asChild size="sm" variant="outline"><a href={`/app/pedidos/${orderId}/presupuesto/${q.id}/pdf`} target="_blank" rel="noreferrer"><FileText /> PDF</a></Button>
                <Button asChild size="sm" variant="ghost"><a href={`/p/presupuesto/${q.publicToken}`} target="_blank" rel="noreferrer"><ExternalLink /> Enlace</a></Button>
                {canEdit && latest && q.status !== "aceptado" && <Button size="sm" variant="ghost" onClick={() => setSend({ id: q.id, number: q.number })}><Send /> {q.status === "rechazado" ? "Reenviar" : "Enviar"}</Button>}
                {canEdit && latest && (q.status === "borrador" || q.status === "enviado") && (
                  <Button size="sm" variant="ghost" disabled={pending} title="El cliente lo ha rechazado: su enlace deja de poder aceptarse" onClick={() => start(async () => { const r = await rejectQuote({ quoteId: q.id }); if (!r.ok) { toast.error(r.error); return; } toast.success("Presupuesto marcado como rechazado"); router.refresh(); })}>
                    <Ban /> Marcar rechazado
                  </Button>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-1 border-t pt-3">
        {canInvoice && (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await createInvoiceFromOrderAction({ orderId, kind: "anticipo", percent: depositPct }); if (r.ok) router.push(`/app/ventas/${r.data.id}`); else toast.error(r.error); })}><Receipt /> Anticipo {depositPct} %</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await createInvoiceFromOrderAction({ orderId, kind: "normal" }); if (r.ok) router.push(`/app/ventas/${r.data.id}`); else toast.error(r.error); })}><Receipt /> Facturar</Button>
          </>
        )}
        <Button asChild size="sm" variant="ghost"><Link href={`/app/almacen?pedido=${orderId}`}><Warehouse /> Lista de carga</Link></Button>
        {canEdit && <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await duplicateOrder({ orderId }); if (r.ok) router.push(`/app/pedidos/${r.data.id}`); else toast.error(r.error); })}><Copy /> Duplicar</Button>}
      </div>
      <Dialog open={!!send} onOpenChange={(o) => !o && setSend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar presupuesto {send?.number}</DialogTitle>
            <DialogDescription>El cliente recibirá un enlace para ver el presupuesto, la carpa en 3D y aceptarlo con firma.</DialogDescription>
          </DialogHeader>
          <Field label="Para" htmlFor="q-to"><Input id="q-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Mensaje" htmlFor="q-msg"><Textarea id="q-msg" rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
          <DialogFooter>
            <Button disabled={pending || !to} onClick={() => start(async () => { const r = await sendQuote({ quoteId: send!.id, to, message: msg }); if (!r.ok) { toast.error(r.fieldErrors?.to ?? r.error); return; } toast.success("Presupuesto enviado"); setSend(null); router.refresh(); })}>
              <Send /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
