import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assignments, eq, and, withTenant } from "@rentevent/db";
import { putObject } from "@/lib/adapters/storage";
import { getAppContext } from "@/server/context";
import { findWorkerForUser } from "@/server/crew/data";

/** Job report photo upload from the worker app (start/end photos). */
export async function POST(req: Request) {
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const shiftId = String(form.get("shiftId") ?? "");
  const stage = String(form.get("stage") ?? "");
  if (!(file instanceof File) || !/^[0-9a-f-]{36}$/.test(shiftId) || !["inicio", "fin"].includes(stage)) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Solo imágenes" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "La foto supera 10 MB" }, { status: 400 });
  const key = `${ctx.tenantId}/partes/${shiftId}/${stage}-${randomUUID()}.jpg`;
  const allowed = await withTenant(ctx.tenantId, async (tx) => {
    const w = await findWorkerForUser(tx, ctx.user.id);
    if (!w) return false;
    const [a] = await tx.select().from(assignments).where(and(eq(assignments.shiftId, shiftId), eq(assignments.workerId, w.id)));
    return Boolean(a);
  });
  if (!allowed) return NextResponse.json({ error: "No estás asignado a este turno" }, { status: 403 });
  await putObject(key, Buffer.from(await file.arrayBuffer()), file.type === "image/png" ? "image/png" : "image/jpeg");
  return NextResponse.json({ key });
}
