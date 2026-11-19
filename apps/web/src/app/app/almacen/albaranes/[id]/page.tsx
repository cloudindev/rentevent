import { notFound } from "next/navigation";
import { FileSignature, FileText } from "lucide-react";
import { contacts, deliveryNotes, eq, orders } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/permissions";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { SignForm } from "./sign-form";

export type NoteLine = { itemId: string; name: string; sku: string; unit: string; quantity: number; damaged: number; serials: string[] };

export default async function DeliveryNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await tenantDb(async (tx, ctx) => {
    const [n] = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.id, id));
    if (!n) return null;
    const [o] = await tx.select().from(orders).where(eq(orders.id, n.orderId));
    const [c] = o?.clientId ? await tx.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, o.clientId)) : [undefined];
    return { n, o, client: c?.name ?? null, canWork: can(ctx.role, "almacen") };
  });
  if (!d) notFound();
  const lines = (d.n.lines as NoteLine[]) ?? [];
  return (
    <>
      <PageHeader icon={FileSignature} title={`Albarán ${d.n.number}`} subtitle={d.n.kind === "entrega" ? "Entrega" : "Recogida"} back={{ href: "/app/almacen/albaranes", label: "Albaranes" }}>
        {d.n.signedAt ? <StatusPill tone="success">Firmado</StatusPill> : <StatusPill tone="warning">Sin firmar</StatusPill>}
        <Button asChild size="sm" variant="outline">
          <a href={`/app/almacen/albaranes/${id}/pdf`} target="_blank" rel="noreferrer"><FileText /> PDF</a>
        </Button>
      </PageHeader>
      <PageBody className="max-w-4xl">
        <p className="text-sm text-muted-foreground">
          Pedido {d.o?.number} · {d.o?.title} · {d.client ?? "Sin cliente"}
        </p>
        <Table>
          <THead>
            <TR>
              <TH>Artículo</TH>
              <TH>Código</TH>
              <TH className="text-right">Cantidad</TH>
              {d.n.kind === "recogida" && <TH className="text-right">Con daños</TH>}
            </TR>
          </THead>
          <TBody>
            {lines.map((l) => (
              <TR key={l.itemId}>
                <TD>
                  {l.name}
                  {l.serials?.length > 0 && <span className="block text-xs text-muted-foreground">{l.serials.join(", ")}</span>}
                </TD>
                <TD className="font-mono text-xs">{l.sku}</TD>
                <TD className="tabular text-right">{formatNumber(l.quantity)} {l.unit === "m2" ? "m²" : ""}</TD>
                {d.n.kind === "recogida" && <TD className="tabular text-right">{l.damaged || "—"}</TD>}
              </TR>
            ))}
          </TBody>
        </Table>
        {d.n.signedAt ? (
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm">Firmado por <strong>{d.n.signedName}</strong> el {formatDateTime(d.n.signedAt)}</p>
            {d.n.signature && <img src={d.n.signature} alt={`Firma de ${d.n.signedName}`} className="mt-2 h-28 rounded-lg border bg-white" />}
          </div>
        ) : d.canWork ? (
          <SignForm id={id} />
        ) : null}
      </PageBody>
    </>
  );
}
