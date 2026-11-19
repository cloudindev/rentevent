import "server-only";
import { z } from "zod";
import { withTenant, type Tx } from "@rentevent/db";
import { can, type Permission } from "@/lib/permissions";
import { getAppContext, type AppContext } from "./context";

export type ActionResult<T = unknown> = { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export class UserError extends Error {}

/**
 * Wraps a Server Action: authenticates, checks the permission, validates the
 * input with Zod and runs the handler inside a tenant-scoped RLS transaction.
 */
export function tenantAction<S extends z.ZodType, T>(
  schema: S,
  permission: Permission,
  handler: (input: z.infer<S>, tx: Tx, ctx: AppContext) => Promise<T>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const ctx = await getAppContext();
    if (!ctx) return { ok: false, error: "Tu sesión ha caducado. Vuelve a iniciar sesión." };
    if (!can(ctx.role, permission)) return { ok: false, error: "No tienes permiso para esta acción." };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
      return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
    }
    try {
      const data = await withTenant(ctx.tenantId, (tx) => handler(parsed.data, tx, ctx));
      return { ok: true, data };
    } catch (e) {
      if (e instanceof UserError) return { ok: false, error: e.message };
      console.error(e);
      return { ok: false, error: "No se ha podido completar la operación. Inténtalo de nuevo." };
    }
  };
}

/** Coerce helpers for FormData-free JSON payloads. */
export const zId = z.string().uuid();
export const zText = (max = 200) => z.string().trim().max(max);
export const zOptText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const zMoney = z.coerce.number().min(-1e9).max(1e9);
export const zDate = z.coerce.date();
