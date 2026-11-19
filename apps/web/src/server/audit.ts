import "server-only";
import { auditLog, type Tx } from "@rentevent/db";
import type { AppContext } from "./context";

export type AuditAction = "crear" | "editar" | "borrar" | "confirmar" | "cancelar" | "enviar" | "aceptar" | "importar" | "exportar" | "acceso" | "estado";

/** Shallow diff of changed keys, ignoring timestamps. */
export function diffOf(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const out: Record<string, { de: unknown; a: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (k === "updatedAt" || k === "createdAt") continue;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { de: a ?? null, a: b ?? null };
  }
  return out;
}

export async function audit(tx: Tx, ctx: Pick<AppContext, "user"> | null, entity: string, entityId: string, action: AuditAction, diff?: unknown) {
  await tx.insert(auditLog).values({
    userId: ctx?.user.id ?? null,
    userName: ctx?.user.name ?? "Sistema",
    entity,
    entityId,
    action,
    diff: (diff ?? null) as object | null,
  });
}
