import { NextResponse } from "next/server";
import { eq, venues, withTenant } from "@rentevent/db";
import { fileUrl, putObject } from "@/lib/adapters/storage";
import { can } from "@/lib/permissions";
import { audit } from "@/server/audit";
import { getAppContext } from "@/server/context";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Uploads the venue site plan (image) used to place tents at scale. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!can(ctx.role, "comercial")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  const mpp = Number(form.get("metresPerPixel") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Formato no admitido (PNG, JPG o WebP)" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "El plano supera 8 MB" }, { status: 400 });
  const key = `${ctx.tenantId}/espacios/${id}/plano-${Date.now()}.${ext}`;
  const ok = await withTenant(ctx.tenantId, async (tx) => {
    const [v] = await tx.select({ id: venues.id }).from(venues).where(eq(venues.id, id));
    if (!v) return false;
    await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
    await tx
      .update(venues)
      .set({ planImageUrl: fileUrl(key), metresPerPixel: Number.isFinite(mpp) && mpp > 0 ? mpp : null })
      .where(eq(venues.id, id));
    await audit(tx, ctx, "venue", id, "editar", { plano: key });
    return true;
  });
  if (!ok) return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, url: fileUrl(key) });
}
