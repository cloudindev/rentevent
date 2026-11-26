import { tenantSettings, withTenant } from "@rentevent/db";
import { fileUrl, putObject } from "@/lib/adapters/storage";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { audit } from "@/server/audit";

/** The PDF renderer only embeds PNG and JPG. */
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

/** Quote cover page upload (multipart, ≤ 8 MB). */
export async function POST(req: Request) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "configuracion")) return Response.json({ error: "No autorizado" }, { status: 403 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "Adjunta una imagen" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Formato no admitido (PNG o JPG)" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Máximo 8 MB" }, { status: 413 });
  const key = `${ctx.tenantId}/marca/portada-${Date.now()}.${ext}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  const url = fileUrl(key);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.update(tenantSettings).set({ quoteCoverUrl: url });
    await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { portada: key });
  });
  return Response.json({ url });
}

export async function DELETE() {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "configuracion")) return Response.json({ error: "No autorizado" }, { status: 403 });
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.update(tenantSettings).set({ quoteCoverUrl: null });
    await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { portada: null });
  });
  return Response.json({ ok: true });
}
