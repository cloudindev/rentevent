import "server-only";
import { and, apiKeys, eq, isNull, systemDb, withTenant, type Tx } from "@rentevent/db";
import { hashApiKey, looksLikeApiKey, takeToken } from "./keys";
import { loadPlanAccess } from "../billing/tenant-access";

export type ApiContext = { tenantId: string; keyId: string; keyName: string };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

const baseHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Api-Version": "1" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...headers } });
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message, details: e.details ?? null } }, e.status, e.status === 429 ? { "Retry-After": String((e.details as { retryAfter?: number })?.retryAfter ?? 1) } : {});
  console.error(e);
  return json({ error: { code: "internal_error", message: "Error interno" } }, 500);
}

/** Authenticates `Authorization: Bearer rv_live_…`, rate-limits and runs `fn` under the key's tenant (RLS). */
export async function withApiKey<T>(req: Request, fn: (tx: Tx, api: ApiContext) => Promise<T>): Promise<Response> {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const secret = auth.replace(/^Bearer\s+/i, "").trim();
    if (!looksLikeApiKey(secret)) throw new ApiError(401, "unauthorized", "Falta la clave de API (Authorization: Bearer rv_live_…)");
    const [key] = await systemDb()
      .select({ id: apiKeys.id, tenantId: apiKeys.tenantId, name: apiKeys.name })
      .from(apiKeys)
      .where(and(eq(apiKeys.hash, hashApiKey(secret)), isNull(apiKeys.revokedAt)));
    if (!key) throw new ApiError(401, "unauthorized", "Clave de API no válida o revocada");
    const rl = takeToken(key.id, 120, 2);
    if (!rl.ok) throw new ApiError(429, "rate_limited", "Demasiadas peticiones", { retryAfter: rl.retryAfter });
    void systemDb().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id)).catch(() => {});
    const data = await withTenant(key.tenantId, async (tx) => {
      if (!(await loadPlanAccess(tx)).api) throw new ApiError(403, "plan_required", "La API está incluida en el plan Empresa de Rentevent");
      return fn(tx, { tenantId: key.tenantId, keyId: key.id, keyName: key.name });
    });
    if (data instanceof Response) return data;
    return json(data, 200, { "X-RateLimit-Remaining": String(rl.remaining) });
  } catch (e) {
    return errorResponse(e);
  }
}

export function pageParams(req: Request) {
  const u = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(u.searchParams.get("limit") ?? 50) || 50));
  const cursor = u.searchParams.get("cursor");
  return { limit, cursor, url: u };
}

/** Cursor = last id (uuid order). */
export function page<T extends { id: string }>(rows: T[], limit: number) {
  const more = rows.length > limit;
  const data = more ? rows.slice(0, limit) : rows;
  return { data, next_cursor: more ? data[data.length - 1]!.id : null };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "El cuerpo debe ser JSON válido");
  }
}
