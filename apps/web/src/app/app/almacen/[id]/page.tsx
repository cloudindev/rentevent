import { notFound } from "next/navigation";
import { and, deliveryNotes, eq } from "@rentevent/db";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadPickList } from "@/server/warehouse/picklists";
import { PickListDetail } from "./detail";

export const metadata = { title: "Lista de almacén" };

export default async function PickListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ codigo?: string }> }) {
  const { id } = await params;
  const { codigo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await tenantDb(async (tx, ctx) => {
    const data = await loadPickList(tx, id);
    if (!data) return null;
    const [note] = await tx.select({ id: deliveryNotes.id, number: deliveryNotes.number, signedAt: deliveryNotes.signedAt }).from(deliveryNotes).where(and(eq(deliveryNotes.orderId, data.list.orderId), eq(deliveryNotes.kind, data.list.kind === "salida" ? "entrega" : "recogida")));
    return { data, note: note ?? null, canWork: can(ctx.role, "almacen") };
  });
  if (!d) notFound();
  const { data } = d;
  return (
    <PickListDetail
      list={{ id: data.list.id, kind: data.list.kind as "salida" | "retorno", status: data.list.status, dueAt: data.list.dueAt?.toISOString() ?? null }}
      order={data.order ? { id: data.order.id, number: data.order.number, title: data.order.title, status: data.order.status, periodStart: data.order.periodStart.toISOString(), periodEnd: data.order.periodEnd.toISOString() } : null}
      clientName={data.clientName}
      lines={data.lines}
      note={d.note ? { id: d.note.id, number: d.note.number, signed: Boolean(d.note.signedAt) } : null}
      canWork={d.canWork}
      initialCode={codigo ?? null}
    />
  );
}
