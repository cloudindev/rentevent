"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { recordInspection } from "@/server/actions/maintenance";

type Row = { key: string; itemId: string; unitId: string | null; name: string; serial: string | null; category: string; last: string | null; nextDue: string | null; status: "vencida" | "proxima" | "ok" | "sin_plan"; daysLeft: number | null };
const TONE = { vencida: "danger", proxima: "warning", ok: "success", sin_plan: "neutral" } as const;
const LABEL = { vencida: "Vencida", proxima: "Próxima", ok: "Al día", sin_plan: "Sin plan" } as const;

export function InspectionList({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"pendientes" | "todas">("pendientes");
  const [target, setTarget] = useState<Row | null>(null);
  const [result, setResult] = useState<"ok" | "defectos" | "no_apto">("ok");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const shown = useMemo(() => (filter === "pendientes" ? rows.filter((r) => r.status === "vencida" || r.status === "proxima") : rows), [rows, filter]);
  const counts = { vencida: rows.filter((r) => r.status === "vencida").length, proxima: rows.filter((r) => r.status === "proxima").length };
  if (rows.length === 0)
    return <EmptyState icon={ShieldCheck} title="Sin plan de revisiones" description="Indica en cada artículo cada cuántos días hay que revisarlo (estructuras y lonas) y aparecerá aquí." />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone="danger">{counts.vencida} vencidas</StatusPill>
        <StatusPill tone="warning">{counts.proxima} en 30 días</StatusPill>
        <NativeSelect aria-label="Filtro" className="ml-auto w-auto" value={filter} onChange={(e) => setFilter(e.target.value as "pendientes")}>
          <option value="pendientes">Vencidas y próximas</option>
          <option value="todas">Todas</option>
        </NativeSelect>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-subtle text-[13px] text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 px-4 text-left font-normal">Artículo</th>
              <th className="px-3 text-left font-normal">Unidad</th>
              <th className="px-3 text-left font-normal">Última</th>
              <th className="px-3 text-left font-normal">Próxima</th>
              <th className="px-3 text-left font-normal">Estado</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} className="border-b last:border-0 hover:bg-subtle">
                <td className="px-4 py-2.5">
                  <Link href={`/app/mantenimiento/historial?articulo=${r.itemId}`} className="font-medium hover:underline">{r.name}</Link>
                  <span className="block text-xs text-muted-foreground">{r.category}</span>
                </td>
                <td className="px-3">{r.serial ?? "Todo el lote"}</td>
                <td className="px-3">{r.last ? formatDate(r.last) : "—"}</td>
                <td className="px-3">{r.nextDue ? formatDate(r.nextDue) : "—"}{r.daysLeft != null && <span className="ml-1 text-xs text-muted-foreground">({r.daysLeft < 0 ? `hace ${-r.daysLeft} d` : `en ${r.daysLeft} d`})</span>}</td>
                <td className="px-3"><StatusPill tone={TONE[r.status]}>{LABEL[r.status]}</StatusPill></td>
                <td className="pr-3 text-right">
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => { setTarget(r); setResult("ok"); setNotes(""); setQty(1); }}>
                      <ClipboardCheck /> Revisar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Todo al día.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar revisión</DialogTitle>
            <DialogDescription>{target?.name}{target?.serial ? ` · ${target.serial}` : ""}. Si no es apta se abre una reparación y deja de estar disponible.</DialogDescription>
          </DialogHeader>
          <Field label="Resultado" htmlFor="ins-res">
            <NativeSelect id="ins-res" value={result} onChange={(e) => setResult(e.target.value as "ok")}>
              <option value="ok">Apta</option>
              <option value="defectos">Con defectos leves (sigue en servicio)</option>
              <option value="no_apto">No apta (a reparación)</option>
            </NativeSelect>
          </Field>
          {result === "no_apto" && !target?.unitId && (
            <Field label="Unidades no aptas" htmlFor="ins-q"><Input id="ins-q" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          )}
          <Field label="Observaciones" htmlFor="ins-notes"><Textarea id="ins-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!target) return;
                  const r = await recordInspection({ itemId: target.itemId, unitId: target.unitId, result, notes: notes || null, quantity: target.unitId ? 1 : qty });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success(r.data.repairId ? "Revisión registrada y reparación abierta" : `Revisión registrada${r.data.nextDueAt ? `. Próxima: ${formatDate(r.data.nextDueAt)}` : ""}`);
                  setTarget(null);
                  router.refresh();
                })
              }
            >
              Guardar revisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
