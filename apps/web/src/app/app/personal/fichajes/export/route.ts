import { NextResponse } from "next/server";
import { withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { audit } from "@/server/audit";
import { payrollCsv } from "@/server/crew/hours";
import { loadRegister } from "@/server/crew/register";

export async function GET(req: Request) {
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!can(ctx.role, "personal")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const month = new URL(req.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Mes no válido (AAAA-MM)" }, { status: 400 });
  const csv = await withTenant(ctx.tenantId, async (tx) => {
    const r = await loadRegister(tx, month);
    await audit(tx, ctx, "registro_horario", month, "exportar");
    return payrollCsv(r.rows, new Map(r.workers.map((w) => [w.id, w.name])));
  });
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="registro-horario-${month}.csv"`, "Cache-Control": "no-store" },
  });
}
