import Link from "next/link";
import { PackageCheck, Warehouse } from "lucide-react";
import { and, asc, contacts, eq, gte, inArray, orders, pickListLines, pickLists, sql } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Progress } from "@/components/warehouse/progress";
import { can } from "@/lib/permissions";
import { formatDateTime, formatRange } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { PICK_STATUS_LABEL, PICK_STATUS_TONE, listStatus, nowMs, progress, type PickKind, type PickStatus } from "@/server/warehouse/logic";
import { AlmacenTabs } from "./tabs";
import { OpenListButton } from "./open-list-button";

type ListRow = { id: string; number: string; title: string; client: string | null; periodStart: Date; periodEnd: Date; dueAt: Date | null; pct: number; live: PickStatus };

function Section({ rows, heading, kind }: { rows: ListRow[]; heading: string; kind: PickKind }) {
  return (
rows.length === 0 ? null : (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{heading}</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {rows.map((l) => (
              <li key={l.id}>
                <Link href={`/app/almacen/${l.id}`} className="grid items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-subtle sm:grid-cols-[minmax(0,1fr)_170px_140px_120px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      <span className="tabular text-muted-foreground">{l.number}</span> · {l.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{l.client ?? "Sin cliente"} · {formatRange(l.periodStart, l.periodEnd)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{kind === "salida" ? "Carga" : "Retorno"} {formatDateTime(l.dueAt)}</span>
                  <span className="flex items-center gap-2">
                    <Progress value={l.pct} tone={l.live === "retrasado" ? "danger" : l.pct === 100 ? "success" : "default"} />
                    <span className="tabular w-9 text-right text-xs text-muted-foreground">{l.pct}%</span>
                  </span>
                  <span className="sm:text-right">
                    <StatusPill tone={PICK_STATUS_TONE[l.live]}>{PICK_STATUS_LABEL[l.live]}</StatusPill>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ));
}

export async function PickListsView({ kind }: { kind: PickKind }) {
  const d = await tenantDb(async (tx, ctx) => {
    const lists = await tx
      .select({ id: pickLists.id, status: pickLists.status, dueAt: pickLists.dueAt, orderId: orders.id, number: orders.number, title: orders.title, periodStart: orders.periodStart, periodEnd: orders.periodEnd, client: contacts.name })
      .from(pickLists)
      .innerJoin(orders, eq(orders.id, pickLists.orderId))
      .leftJoin(contacts, eq(contacts.id, orders.clientId))
      .where(eq(pickLists.kind, kind))
      .orderBy(asc(pickLists.dueAt));
    const lines = lists.length
      ? await tx
          .select({ listId: pickListLines.pickListId, quantity: pickListLines.quantity, prepared: pickListLines.prepared, loaded: pickListLines.loaded, returned: pickListLines.returned, damaged: pickListLines.damaged, lost: pickListLines.lost })
          .from(pickListLines)
          .where(inArray(pickListLines.pickListId, lists.map((l) => l.id)))
      : [];
    const statuses = kind === "salida" ? ["confirmado", "opcion"] : ["en_curso"];
    const since = new Date(nowMs() - 30 * 86_400_000);
    const pending = await tx
      .select({
        id: orders.id,
        number: orders.number,
        title: orders.title,
        periodStart: orders.periodStart,
        periodEnd: orders.periodEnd,
        status: orders.status,
        // an order still on site after a partial return: the rest is received on a follow-up list
        partial: sql<boolean>`exists (select 1 from pick_lists p where p.order_id = ${orders.id} and p.kind = ${kind} and p.status = 'devuelto')`,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.status, statuses),
          gte(kind === "salida" ? orders.periodStart : orders.periodEnd, since),
          kind === "retorno"
            ? sql`not exists (select 1 from pick_lists p where p.order_id = ${orders.id} and p.kind = ${kind} and p.status <> 'devuelto')`
            : sql`not exists (select 1 from pick_lists p where p.order_id = ${orders.id} and p.kind = ${kind})`,
        ),
      )
      .orderBy(asc(kind === "salida" ? orders.periodStart : orders.periodEnd));
    return { lists, lines, pending, canWork: can(ctx.role, "almacen") };
  });
  const now = new Date(nowMs());
  const enriched = d.lists.map((l) => {
    const ls = d.lines.filter((x) => x.listId === l.id).map((x) => ({ quantity: Number(x.quantity), prepared: Number(x.prepared), loaded: Number(x.loaded), returned: Number(x.returned), damaged: Number(x.damaged), lost: Number(x.lost) }));
    const closed = l.status === "en_obra" || (kind === "retorno" && l.status === "devuelto");
    return { ...l, units: ls.reduce((s, x) => s + x.quantity, 0), pct: closed ? 100 : progress(ls, kind), live: listStatus(ls, kind, { dueAt: l.dueAt, now, closed }) as PickStatus };
  });
  const open = enriched.filter((l) => !(l.live === "en_obra" || l.live === "devuelto"));
  const done = enriched.filter((l) => l.live === "en_obra" || l.live === "devuelto");
  const title = kind === "salida" ? "Salidas" : "Retornos";
  return (
    <>
      <PageHeader icon={Warehouse} title="Almacén" subtitle={title} />
      <AlmacenTabs />
      <PageBody>
        {d.pending.length > 0 && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{kind === "salida" ? "Pedidos confirmados sin lista de carga" : "Pedidos en obra sin retorno abierto"}</h2>
            <ul className="mt-2 divide-y text-sm">
              {d.pending.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="tabular text-muted-foreground">{o.number}</span> · {o.title} <span className="text-muted-foreground">· {formatRange(o.periodStart, o.periodEnd)}</span>
                    {o.partial && <span className="text-warning"> · retorno parcial, falta material</span>}
                  </span>
                  {d.canWork && <OpenListButton orderId={o.id} kind={kind} label={o.partial ? "Recibir lo pendiente" : undefined} />}
                </li>
              ))}
            </ul>
          </section>
        )}
        {enriched.length === 0 && d.pending.length === 0 ? (
          <EmptyState icon={PackageCheck} title={kind === "salida" ? "No hay cargas pendientes" : "No hay retornos pendientes"} description={kind === "salida" ? "Las listas de carga se generan desde el despiece de cada pedido confirmado." : "Cuando un pedido está en obra puedes preparar su retorno con recuento de daños y pérdidas."} />
        ) : (
          <>
            <Section kind={kind} rows={open} heading={kind === "salida" ? "Por preparar y cargar" : "Pendientes de volver"} />
            <Section kind={kind} rows={done} heading={kind === "salida" ? "Cargadas" : "Cerradas"} />
          </>
        )}
      </PageBody>
    </>
  );
}
