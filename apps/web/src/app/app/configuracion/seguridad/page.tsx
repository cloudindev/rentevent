import { and, asc, auditLog, contacts, desc, eq, gte, ilike } from "@rentevent/db";
import { PageBody } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireApp, tenantDb } from "@/server/context";
import { formatDateTime } from "@/lib/utils";
import { DangerZone, AuditFilters, ContactRgpd } from "./security-client";

export const metadata = { title: "Seguridad y datos" };

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

const ACTIONS = ["crear", "editar", "borrar", "confirmar", "cancelar", "enviar", "aceptar", "importar", "exportar", "estado", "acceso"];

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ entidad?: string; accion?: string; usuario?: string; dias?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireApp("configuracion");
  const days = Math.min(365, Math.max(1, Number(sp.dias ?? 30) || 30));
  const d = await tenantDb(async (tx) => ({
    rows: await tx
      .select()
      .from(auditLog)
      .where(and(gte(auditLog.createdAt, since(days)), sp.entidad ? eq(auditLog.entity, sp.entidad) : undefined, sp.accion ? eq(auditLog.action, sp.accion) : undefined, sp.usuario ? ilike(auditLog.userName, `%${sp.usuario}%`) : undefined))
      .orderBy(desc(auditLog.createdAt))
      .limit(200),
    entities: (await tx.selectDistinct({ e: auditLog.entity }).from(auditLog).orderBy(asc(auditLog.entity))).map((x) => x.e),
    contacts: await tx.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(asc(contacts.name)),
  }));
  return (
    <PageBody className="max-w-5xl">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Registro de auditoría</CardTitle>
            <CardDescription>Cada cambio en la empresa queda registrado con su autor, fecha y campos modificados.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <AuditFilters entities={d.entities} actions={ACTIONS} current={{ entidad: sp.entidad ?? "", accion: sp.accion ?? "", usuario: sp.usuario ?? "", dias: String(days) }} />
          <div className="max-h-[480px] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-subtle">
                <tr className="text-left text-[13px] text-muted-foreground">
                  <th className="px-3 py-2 font-normal">Fecha</th>
                  <th className="px-3 py-2 font-normal">Usuario</th>
                  <th className="px-3 py-2 font-normal">Acción</th>
                  <th className="px-3 py-2 font-normal">Entidad</th>
                  <th className="px-3 py-2 font-normal">Cambios</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2">{r.userName ?? "Sistema"}</td>
                    <td className="px-3 py-2">{r.action}</td>
                    <td className="px-3 py-2"><code className="text-xs">{r.entity}</code></td>
                    <td className="max-w-80 truncate px-3 py-2 text-xs text-muted-foreground" title={r.diff ? JSON.stringify(r.diff) : ""}>{r.diff ? JSON.stringify(r.diff).slice(0, 160) : "—"}</td>
                  </tr>
                ))}
                {d.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Sin registros con estos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Protección de datos (RGPD)</CardTitle>
            <CardDescription>Portabilidad, acceso y supresión. Los datos se alojan en la Unión Europea.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <span>
              <span className="block font-medium">Exportar todos los datos de la empresa</span>
              <span className="text-muted-foreground">Un archivo JSON con todas las tablas: pedidos, inventario, contactos, facturas, personal…</span>
            </span>
            <a className="inline-flex h-9 items-center rounded-md border px-3.5 text-sm font-medium hover:bg-accent" href="/app/configuracion/datos/exportar">Descargar exportación</a>
          </div>
          <ContactRgpd contacts={d.contacts} />
          <div className="rounded-lg border p-3">
            <p className="font-medium">Copias de seguridad</p>
            <p className="text-muted-foreground">La base de datos PostgreSQL se copia automáticamente cada día con recuperación a un instante (PITR) en el proveedor gestionado de la UE. Para una copia propia, usa la exportación de arriba.</p>
          </div>
        </CardContent>
      </Card>
      {ctx.role === "administrador" && <DangerZone slug={ctx.slug} name={ctx.tenantName} />}
    </PageBody>
  );
}
