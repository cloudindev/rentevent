import { tenantSettings, withTenant } from "@rentevent/db";
import { fileUrl, putObject } from "@/lib/adapters/storage";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { audit } from "@/server/audit";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };

/** Company logo upload (multipart, ≤ 2 MB). */
export async function POST(req: Request) {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "configuracion")) return Response.json({ error: "No autorizado" }, { status: 403 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "Adjunta una imagen" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "Formato no admitido (PNG, JPG, SVG o WebP)" }, { status: 400 });
  if (file.size > 2 * 1024 * 1024) return Response.json({ error: "Máximo 2 MB" }, { status: 413 });
  const key = `${ctx.tenantId}/marca/logo-${Date.now()}.${ext}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  const url = fileUrl(key);
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.update(tenantSettings).set({ logoUrl: url });
    await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { logo: key });
  });
  return Response.json({ url });
}
