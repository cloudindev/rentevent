import { randomBytes } from "node:crypto";
import { files, withTenant } from "@rentevent/db";
import { putObject } from "@/lib/adapters/storage";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { audit } from "@/server/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "comercial")) return new Response("No autorizado", { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 15 * 1024 * 1024) return new Response("Archivo no válido", { status: 400 });
  const safe = file.name.replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, "_").slice(0, 120);
  const key = `${ctx.tenantId}/proyectos/${id}/${randomBytes(6).toString("hex")}-${safe}`;
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
  await withTenant(ctx.tenantId, async (tx) => {
    await tx.insert(files).values({ entity: "project", entityId: id, name: safe, key, contentType: file.type || "application/octet-stream", size: file.size, uploadedBy: ctx.user.id });
    await audit(tx, ctx, "project", id, "editar", { archivo: safe });
  });
  return Response.json({ ok: true });
}
