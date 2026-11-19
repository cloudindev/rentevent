import { getObject } from "@/lib/adapters/storage";
import { getAppContext } from "@/server/context";

/** Serves stored objects; keys are prefixed with the tenant id, so users only reach their company's files. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const ctx = await getAppContext();
  if (!ctx) return new Response("No autorizado", { status: 401 });
  const path = key.map(decodeURIComponent).join("/");
  if (!path.startsWith(`${ctx.tenantId}/`) || path.includes("..")) return new Response("No encontrado", { status: 404 });
  const obj = await getObject(path);
  if (!obj) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(obj.body), { headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
