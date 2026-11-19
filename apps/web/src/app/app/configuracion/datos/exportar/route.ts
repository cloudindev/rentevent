import { sql, withTenant } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { getAppContext } from "@/server/context";
import { audit } from "@/server/audit";

/**
 * RGPD portability: every tenant-scoped table as one JSON document, read
 * under RLS so only this company's rows can ever be included.
 */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx || !can(ctx.role, "configuracion")) return new Response("No autorizado", { status: 403 });
  const data = await withTenant(ctx.tenantId, async (tx) => {
    const tables = await tx.execute<{ table_name: string }>(sql`select c.table_name from information_schema.columns c join pg_tables p on p.tablename = c.table_name and p.schemaname = 'public' where c.table_schema = 'public' and c.column_name = 'tenant_id' and c.table_name not in ('jobs') order by 1`);
    const out: Record<string, unknown[]> = {};
    for (const t of tables.rows) {
      const name = t.table_name.replace(/[^a-z_]/g, "");
      const rows = await tx.execute(sql.raw(`select * from "${name}"`));
      out[name] = rows.rows;
    }
    const members = await tx.execute(sql`select m.id, m.role, m.created_at, u.name, u.email from member m join "user" u on u.id = m.user_id`);
    out.miembros = members.rows;
    await audit(tx, ctx, "tenant", ctx.tenantId, "exportar", { tablas: Object.keys(out).length });
    return out;
  });
  const body = JSON.stringify({ empresa: { id: ctx.tenantId, nombre: ctx.tenantName, subdominio: ctx.slug }, exportado: new Date().toISOString(), formato: "rentevent-export-v1", datos: data }, null, 2);
  return new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="rentevent-${ctx.slug}-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}
