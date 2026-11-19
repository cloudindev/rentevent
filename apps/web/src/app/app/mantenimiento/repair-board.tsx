"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { formatDate, formatEUR, formatNumber } from "@/lib/utils";
import { createRepair, setRepairStatus } from "@/server/actions/maintenance";

export type RepairCard = { id: string; itemId: string; itemName: string; sku: string; serial: string | null; quantity: number; status: string; reason: string; cost: number; resolution: string | null; createdAt: string; closedAt: string | null; orderNumber: string | null };
type ItemOpt = { id: string; name: string; category: string; free: number };

const COLS = [
  { key: "pendiente", label: "Pendiente" },
  { key: "en_curso", label: "En curso" },
  { key: "cerrado", label: "Cerradas (60 días)" },
] as const;

export function RepairBoard({ kind, cards, items, canEdit }: { kind: "reparacion" | "limpieza"; cards: RepairCard[]; items: ItemOpt[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [closing, setClosing] = useState<{ card: RepairCard; status: "reparado" | "baja" } | null>(null);
  const [form, setForm] = useState({ itemId: "", quantity: 1, reason: "" });
  const [cost, setCost] = useState(0);
  const [resolution, setResolution] = useState("");
  const isClean = kind === "limpieza";

  const move = (id: string, status: "en_curso" | "reparado" | "baja", extra?: { cost?: number; resolution?: string | null }) =>
    start(async () => {
      const r = await setRepairStatus({ id, status, ...extra });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(status === "en_curso" ? "En curso" : status === "baja" ? "Dado de baja: sale del stock" : isClean ? "Limpieza terminada: vuelve a estar disponible" : "Reparado: vuelve a estar disponible");
      setClosing(null);
      router.refresh();
    });

  const col = (k: (typeof COLS)[number]["key"]) => cards.filter((c) => (k === "cerrado" ? c.status === "reparado" || c.status === "baja" : c.status === k));
  const open = cards.filter((c) => c.status === "pendiente" || c.status === "en_curso").reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {formatNumber(open)} unidades fuera de servicio por {isClean ? "limpieza" : "reparación"}. No cuentan como disponibles hasta cerrarse.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus /> {isClean ? "Enviar a limpieza" : "Nueva reparación"}
          </Button>
        )}
      </div>
      {cards.length === 0 ? (
        <EmptyState icon={isClean ? Sparkles : Wrench} title={isClean ? "No hay lonas en limpieza" : "No hay reparaciones"} description={isClean ? "Las lonas marcadas como sucias en un retorno aparecen aquí." : "Lo dañado en los retornos y las revisiones no aptas crea reparaciones automáticamente."} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLS.map((c) => (
            <section key={c.key} className="rounded-xl border bg-subtle/60 p-2" aria-label={c.label}>
              <h2 className="flex items-center justify-between px-2 py-1.5 text-[13px] font-medium text-muted-foreground">
                {c.label} <span className="tabular">{col(c.key).length}</span>
              </h2>
              <ul className="space-y-2">
                {col(c.key).map((r) => (
                  <li key={r.id} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/app/mantenimiento/historial?articulo=${r.itemId}`} className="font-medium hover:underline">
                        {r.itemName}
                      </Link>
                      <span className="tabular shrink-0 text-xs">× {formatNumber(r.quantity)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.serial ? `${r.serial} · ` : ""}
                      {r.orderNumber ? `Pedido ${r.orderNumber} · ` : ""}
                      {formatDate(r.createdAt)}
                    </p>
                    <p className="mt-1.5">{r.reason}</p>
                    {(r.status === "reparado" || r.status === "baja") && (
                      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusPill tone={r.status === "baja" ? "danger" : "success"}>{r.status === "baja" ? "Baja" : isClean ? "Limpia" : "Reparado"}</StatusPill>
                        {r.cost > 0 && formatEUR(r.cost)} {r.resolution}
                      </p>
                    )}
                    {canEdit && (r.status === "pendiente" || r.status === "en_curso") && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.status === "pendiente" && (
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => move(r.id, "en_curso")}>
                            Empezar
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => { setCost(r.cost); setResolution(""); setClosing({ card: r, status: "reparado" }); }}>
                          {isClean ? "Limpia" : "Reparado"}
                        </Button>
                        {!isClean && (
                          <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => { setCost(r.cost); setResolution(""); setClosing({ card: r, status: "baja" }); }}>
                            Baja
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
                {col(c.key).length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">Vacío</li>}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isClean ? "Enviar a limpieza" : "Nueva reparación"}</DialogTitle>
            <DialogDescription>Las unidades dejan de estar disponibles hasta que se cierre.</DialogDescription>
          </DialogHeader>
          <Field label="Artículo" htmlFor="rp-item">
            <NativeSelect id="rp-item" value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
              <option value="">Elige…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({formatNumber(i.free)} en servicio)</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Cantidad" htmlFor="rp-q">
            <Input id="rp-q" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Motivo" htmlFor="rp-r">
            <Textarea id="rp-r" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={isClean ? "Barro tras el evento" : "Desgarro, soldadura dañada…"} />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || !form.itemId}
              onClick={() =>
                start(async () => {
                  const r = await createRepair({ itemId: form.itemId, unitId: null, quantity: form.quantity, kind, reason: form.reason || (isClean ? "Limpieza" : "") });
                  if (!r.ok) {
                    toast.error(r.fieldErrors?.reason ?? r.error);
                    return;
                  }
                  setNewOpen(false);
                  setForm({ itemId: "", quantity: 1, reason: "" });
                  router.refresh();
                })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closing} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{closing?.status === "baja" ? "Dar de baja" : isClean ? "Limpieza terminada" : "Marcar como reparado"}</DialogTitle>
            <DialogDescription>
              {closing?.card.itemName} × {closing?.card.quantity}. {closing?.status === "baja" ? "Se descuenta del stock total." : "Vuelve a estar disponible."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Coste (€)" htmlFor="rp-cost">
            <Input id="rp-cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          </Field>
          <Field label="Resolución" htmlFor="rp-res">
            <Input id="rp-res" value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant={closing?.status === "baja" ? "danger" : "default"} disabled={pending} onClick={() => closing && move(closing.card.id, closing.status, { cost, resolution: resolution || null })}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
