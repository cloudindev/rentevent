"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PHASE_LABELS, type PhaseKind } from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { formatDateTime, toLocalInput } from "@/lib/utils";
import { savePhase } from "@/server/actions/projects";
import { fromLocalInput } from "../../pedidos/[id]/header-sheet";

type Phase = { id: string; kind: PhaseKind; startsAt: string; endsAt: string; notes: string | null };
const COLOR: Record<PhaseKind, string> = { carga: "#6b6b68", transporte: "#2c5fb3", montaje: "#e5412a", evento: "#15803d", desmontaje: "#c0311f", retorno: "#6b6b68" };

export function PhaseTimeline({ phases, canEdit }: { phases: Phase[]; canEdit: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Phase | null>(null);
  const [pending, start] = useTransition();
  if (phases.length === 0) return <p className="text-sm text-muted-foreground">Sin fases.</p>;
  const t0 = Math.min(...phases.map((p) => new Date(p.startsAt).getTime()));
  const t1 = Math.max(...phases.map((p) => new Date(p.endsAt).getTime()));
  const pct = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * 100;
  return (
    <div className="space-y-1.5">
      {phases.map((p) => {
        const a = new Date(p.startsAt).getTime();
        const b = new Date(p.endsAt).getTime();
        return (
          <div key={p.id} className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{PHASE_LABELS[p.kind] ?? p.kind}</span>
            <div className="relative h-7 rounded-md bg-subtle">
              <button
                disabled={!canEdit}
                onClick={() => setEdit(p)}
                className="absolute top-0.5 flex h-6 items-center truncate rounded px-2 text-left text-[11px] text-white disabled:cursor-default"
                style={{ left: `${pct(a)}%`, width: `${Math.max(3, pct(b) - pct(a))}%`, background: COLOR[p.kind] }}
                title={`${formatDateTime(p.startsAt)} – ${formatDateTime(p.endsAt)}`}
              >
                {formatDateTime(p.startsAt)}
              </button>
            </div>
          </div>
        );
      })}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Fase: {edit ? PHASE_LABELS[edit.kind] : ""}</DialogTitle></DialogHeader>
          {edit && (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                start(async () => {
                  const r = await savePhase({ id: edit.id, startsAt: fromLocalInput(String(f.get("s"))), endsAt: fromLocalInput(String(f.get("e"))), notes: String(f.get("n") || "") || null });
                  if (!r.ok) { toast.error(r.fieldErrors?.endsAt ?? r.error); return; }
                  setEdit(null);
                  router.refresh();
                });
              }}
            >
              <Field label="Inicio" htmlFor="ph-s"><Input id="ph-s" name="s" type="datetime-local" defaultValue={toLocalInput(edit.startsAt)} /></Field>
              <Field label="Fin" htmlFor="ph-e"><Input id="ph-e" name="e" type="datetime-local" defaultValue={toLocalInput(edit.endsAt)} /></Field>
              <Field label="Notas" htmlFor="ph-n"><Input id="ph-n" name="n" defaultValue={edit.notes ?? ""} /></Field>
              <DialogFooter><Button disabled={pending}>Guardar</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
