"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { HardHat, Plus, Search, Link2 } from "lucide-react";
import { SKILLS, SKILL_LABELS } from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SkillChips, TrainingPill, WORKER_TYPE_LABELS, WorkerDot } from "@/components/crew/bits";
import { EMPTY_WORKER, WorkerSheet, type WorkerFormValue } from "@/components/crew/worker-sheet";
import { formatDate, formatEUR } from "@/lib/utils";

type Row = WorkerFormValue & { id: string; linked: boolean; absence: { kind: string; until: string } | null; upcoming: number };

export function WorkersList({ rows, showCost, canEdit }: { rows: Row[]; showCost: boolean; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<WorkerFormValue | null>(null);
  const filtered = useMemo(
    () => rows.filter((r) => (showInactive || r.active) && (!skill || r.skills.includes(skill)) && (!q || `${r.name} ${r.email} ${r.phone}`.toLowerCase().includes(q.toLowerCase()))),
    [rows, q, skill, showInactive],
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar trabajador…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar trabajador" />
        </div>
        <NativeSelect className="w-48" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Filtrar por habilidad">
          <option value="">Todas las habilidades</option>
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {SKILL_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Ver inactivos
        </label>
        <div className="flex-1" />
        {canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY_WORKER })}>
            <Plus /> Nuevo trabajador
          </Button>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={HardHat} title={rows.length ? "Ningún trabajador coincide" : "Aún no hay trabajadores"} description="Crea las fichas de tu equipo con sus habilidades y formación para planificar los montajes." action={canEdit && !rows.length ? <Button onClick={() => setEditing({ ...EMPTY_WORKER })}>Añadir el primero</Button> : undefined} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Trabajador</TH>
              <TH>Tipo</TH>
              <TH>Habilidades</TH>
              <TH>Formación PRL</TH>
              <TH>Disponibilidad</TH>
              {showCost && <TH className="text-right">€/h</TH>}
              <TH className="w-20" />
            </TR>
          </THead>
          <TBody>
            {filtered.map((r) => (
              <TR key={r.id} className={r.active ? "" : "opacity-60"}>
                <TD>
                  <Link href={`/app/personal/${r.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                    <WorkerDot color={r.color} name={r.name} />
                    <span>
                      {r.name}
                      {r.linked && <Link2 className="ml-1 inline size-3 text-muted-foreground" aria-label="Con acceso a la app" />}
                      <span className="block text-xs font-normal text-muted-foreground">{r.phone || r.email}</span>
                    </span>
                  </Link>
                </TD>
                <TD className="text-muted-foreground">{WORKER_TYPE_LABELS[r.type]}</TD>
                <TD>
                  <SkillChips skills={r.skills} />
                </TD>
                <TD>
                  <TrainingPill expires={r.trainingExpiresAt || null} />
                </TD>
                <TD>
                  {r.absence ? (
                    <StatusPill tone={r.absence.kind === "baja" ? "danger" : "warning"}>
                      {r.absence.kind === "baja" ? "De baja" : r.absence.kind === "vacaciones" ? "Vacaciones" : "Ausente"} hasta {formatDate(r.absence.until, { day: "numeric", month: "short" })}
                    </StatusPill>
                  ) : (
                    <StatusPill tone="success">Disponible</StatusPill>
                  )}
                </TD>
                {showCost && <TD className="tabular text-right">{formatEUR(r.costPerHour)}</TD>}
                <TD className="text-right">
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                      Editar
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {editing && <WorkerSheet key={editing.id ?? "new"} open onOpenChange={(o) => !o && setEditing(null)} initial={editing} showCost={showCost} />}
    </div>
  );
}
