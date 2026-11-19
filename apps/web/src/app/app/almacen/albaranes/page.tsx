import Link from "next/link";
import { FileSignature, Warehouse } from "lucide-react";
import { contacts, deliveryNotes, desc, eq, orders } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { AlmacenTabs } from "../tabs";

export const metadata = { title: "Albaranes" };

export default async function DeliveryNotesPage() {
  const rows = await tenantDb((tx) =>
    tx
      .select({ id: deliveryNotes.id, number: deliveryNotes.number, kind: deliveryNotes.kind, signedAt: deliveryNotes.signedAt, signedName: deliveryNotes.signedName, createdAt: deliveryNotes.createdAt, orderNumber: orders.number, title: orders.title, client: contacts.name })
      .from(deliveryNotes)
      .innerJoin(orders, eq(orders.id, deliveryNotes.orderId))
      .leftJoin(contacts, eq(contacts.id, orders.clientId))
      .orderBy(desc(deliveryNotes.createdAt)),
  );
  return (
    <>
      <PageHeader icon={Warehouse} title="Almacén" subtitle="Albaranes" />
      <AlmacenTabs />
      <PageBody>
        {rows.length === 0 ? (
          <EmptyState icon={FileSignature} title="Sin albaranes" description="Genera el albarán de entrega o recogida desde una lista de carga o de retorno; el cliente lo firma en el móvil o la tableta." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Número</TH>
                <TH>Tipo</TH>
                <TH>Pedido</TH>
                <TH>Cliente</TH>
                <TH>Fecha</TH>
                <TH>Firma</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD><Link href={`/app/almacen/albaranes/${r.id}`} className="font-medium hover:underline">{r.number}</Link></TD>
                  <TD className="capitalize">{r.kind}</TD>
                  <TD><span className="tabular text-muted-foreground">{r.orderNumber}</span> · {r.title}</TD>
                  <TD>{r.client ?? "—"}</TD>
                  <TD>{formatDate(r.createdAt)}</TD>
                  <TD>{r.signedAt ? <StatusPill tone="success">{r.signedName} · {formatDateTime(r.signedAt)}</StatusPill> : <StatusPill tone="warning">Pendiente</StatusPill>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </PageBody>
    </>
  );
}
