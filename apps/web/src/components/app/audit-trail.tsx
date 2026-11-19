import { formatDateTime } from "@/lib/utils";

const ACTION: Record<string, string> = { crear: "creó", editar: "editó", borrar: "eliminó", confirmar: "confirmó", cancelar: "canceló", enviar: "envió", aceptar: "aceptó", importar: "importó", exportar: "exportó", estado: "cambió el estado", acceso: "accedió" };

export type AuditView = { id: string; userName: string | null; action: string; diff: unknown; createdAt: Date | string };

export function AuditTrail({ rows }: { rows: AuditView[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>;
  return (
    <ol className="space-y-2.5 text-sm">
      {rows.map((r) => {
        const diff = r.diff && typeof r.diff === "object" ? Object.keys(r.diff as object) : [];
        return (
          <li key={r.id} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-border-strong" />
            <div>
              <span className="font-medium">{r.userName ?? "Sistema"}</span> {ACTION[r.action] ?? r.action}
              {diff.length > 0 && <span className="text-muted-foreground"> · {diff.slice(0, 4).join(", ")}</span>}
              <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
