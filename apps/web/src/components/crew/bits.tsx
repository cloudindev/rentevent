import { SKILL_LABELS, type Skill } from "@rentevent/core";
import { StatusPill } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { trainingStatus } from "@/server/crew/hours";

export const WORKER_TYPE_LABELS: Record<string, string> = { plantilla: "Plantilla", eventual: "Eventual", autonomo: "Autónomo" };

export function SkillChips({ skills, max = 4 }: { skills: string[]; max?: number }) {
  const shown = skills.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span key={s} className="inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] text-muted-foreground">
          {SKILL_LABELS[s as Skill] ?? s}
        </span>
      ))}
      {skills.length > max && <span className="text-[11px] text-muted-foreground">+{skills.length - max}</span>}
    </span>
  );
}

export function TrainingPill({ expires }: { expires: string | null }) {
  const st = trainingStatus(expires);
  if (st === "sin_formacion") return <StatusPill tone="warning">Sin formación</StatusPill>;
  if (st === "caducada") return <StatusPill tone="danger">Caducada {formatDate(expires!)}</StatusPill>;
  if (st === "proxima") return <StatusPill tone="warning">Caduca {formatDate(expires!)}</StatusPill>;
  return <StatusPill tone="success">Vigente</StatusPill>;
}

export const ASSIGNMENT_TONE: Record<string, "neutral" | "success" | "danger"> = { asignado: "neutral", confirmado: "success", rechazado: "danger" };
export const ASSIGNMENT_LABEL: Record<string, string> = { asignado: "Pendiente", confirmado: "Confirmado", rechazado: "Rechazado" };

export function WorkerDot({ color, name }: { color: string | null; name: string }) {
  return (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: color ?? "#6b6b68" }} aria-hidden>
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
