import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone, Users } from "lucide-react";
import { and, asc, auditLog, contactAddresses, contactPersons, contacts, count, desc, emails, eq, invoices, notes, orders, or, sql } from "@rentevent/db";
import { AuditTrail } from "@/components/app/audit-trail";
import { NotesPanel } from "@/components/app/notes-panel";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { formatDate, formatEUR, formatRange } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { ORDER_STATUS } from "@/components/app/order-status";
import { ContactActions } from "./contact-actions";
import { KIND_LABEL } from "../contacts-table";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await tenantDb(async (tx, ctx) => {
    const [c] = await tx.select().from(contacts).where(eq(contacts.id, id));
    if (!c) return null;
    const [addrs, persons, ords, invs, mails, nts, audits, [orderCount], [money]] = await Promise.all([
      tx.select().from(contactAddresses).where(eq(contactAddresses.contactId, id)).orderBy(desc(contactAddresses.isDefault)),
      tx.select().from(contactPersons).where(eq(contactPersons.contactId, id)).orderBy(asc(contactPersons.name)),
      tx.select().from(orders).where(eq(orders.clientId, id)).orderBy(desc(orders.periodStart)).limit(30),
      tx.select().from(invoices).where(eq(invoices.clientId, id)).orderBy(desc(invoices.issueDate)).limit(30),
      tx.select().from(emails).where(or(and(eq(emails.entity, "contact"), eq(emails.entityId, id)), c.email ? or(eq(emails.fromAddress, c.email), eq(emails.toAddress, c.email)) : undefined)).orderBy(desc(emails.createdAt)).limit(20),
      tx.select().from(notes).where(and(eq(notes.entity, "contact"), eq(notes.entityId, id))).orderBy(desc(notes.createdAt)),
      tx.select().from(auditLog).where(and(eq(auditLog.entity, "contact"), eq(auditLog.entityId, id))).orderBy(desc(auditLog.createdAt)).limit(20),
      // totals over all orders and invoices (the lists below only show the latest 30)
      tx.select({ n: count() }).from(orders).where(eq(orders.clientId, id)),
      tx
        .select({
          n: count(),
          revenue: sql<number>`coalesce(sum(${invoices.total}) filter (where ${invoices.status} not in ('borrador', 'anulada')), 0)::float`,
          pending: sql<number>`coalesce(sum(${invoices.total} - ${invoices.paid}) filter (where ${invoices.status} in ('emitida', 'vencida')), 0)::float`,
        })
        .from(invoices)
        .where(eq(invoices.clientId, id)),
    ]);
    return { c, addrs, persons, ords, invs, mails, nts, audits, orderCount: orderCount?.n ?? 0, invoiceCount: money?.n ?? 0, revenue: Number(money?.revenue ?? 0), pending: Number(money?.pending ?? 0), role: ctx.role };
  });
  if (!d) notFound();
  const { c } = d;
  const { revenue, pending } = d;
  return (
    <>
      <PageHeader icon={Users} title={c.name} back={{ href: "/app/contactos", label: "Contactos" }}>
        <StatusPill tone="info">{KIND_LABEL[c.kind]}</StatusPill>
        {can(d.role, "comercial") && (
          <ContactActions
            contact={{ id: c.id, kind: c.kind as "cliente", name: c.name, legalName: c.legalName, taxId: c.taxId, email: c.email, phone: c.phone, website: c.website, discountPct: Number(c.discountPct), paymentTermsDays: c.paymentTermsDays, tags: c.tags, notes: c.notes }}
            archived={c.archived}
            addresses={d.addrs.map((a) => ({ id: a.id, label: a.label, line1: a.line1, city: a.city, province: a.province, postalCode: a.postalCode, isDefault: a.isDefault }))}
            persons={d.persons.map((p) => ({ id: p.id, name: p.name, position: p.position, email: p.email, phone: p.phone }))}
          />
        )}
      </PageHeader>
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Pedidos", String(d.orderCount)],
                ["Facturado", formatEUR(revenue)],
                ["Pendiente de cobro", formatEUR(pending)],
                ["Descuento", `${Number(c.discountPct)} %`],
              ].map(([k, v]) => (
                <Card key={k} className="p-4">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="tabular mt-1 text-lg font-semibold">{v}</p>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle>Pedidos</CardTitle>{d.orderCount > d.ords.length && <span className="text-xs text-muted-foreground">Últimos {d.ords.length} de {d.orderCount}</span>}</CardHeader>
              <CardContent>
                {d.ords.length === 0 ? <p className="text-sm text-muted-foreground">Sin pedidos.</p> : (
                  <ul className="divide-y text-sm">
                    {d.ords.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                        <Link href={`/app/pedidos/${o.id}`} className="min-w-0 truncate hover:underline"><span className="text-muted-foreground">{o.number}</span> · {o.title}</Link>
                        <span className="flex shrink-0 items-center gap-3"><span className="hidden text-muted-foreground sm:inline">{formatRange(o.periodStart, o.periodEnd)}</span><StatusPill tone={ORDER_STATUS[o.status]?.tone ?? "neutral"}>{ORDER_STATUS[o.status]?.label ?? o.status}</StatusPill></span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Facturas</CardTitle>{d.invoiceCount > d.invs.length && <span className="text-xs text-muted-foreground">Últimas {d.invs.length} de {d.invoiceCount}</span>}</CardHeader>
              <CardContent>
                {d.invs.length === 0 ? <p className="text-sm text-muted-foreground">Sin facturas.</p> : (
                  <ul className="divide-y text-sm">
                    {d.invs.map((i) => (
                      <li key={i.id} className="flex items-center justify-between py-2.5">
                        <Link href={`/app/ventas/${i.id}`} className="hover:underline">{i.fullNumber ?? "Borrador"} · {formatDate(i.issueDate)}</Link>
                        <span className="flex items-center gap-3"><span className="tabular">{formatEUR(Number(i.total))}</span><StatusPill tone={i.status === "cobrada" ? "success" : i.status === "vencida" ? "danger" : "neutral"}>{i.status}</StatusPill></span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Correos</CardTitle></CardHeader>
              <CardContent>
                {d.mails.length === 0 ? <p className="text-sm text-muted-foreground">Sin correos vinculados.</p> : (
                  <ul className="divide-y text-sm">
                    {d.mails.map((m) => (
                      <li key={m.id} className="py-2.5">
                        <Link href={`/app/emails?id=${m.id}`} className="font-medium hover:underline">{m.subject}</Link>
                        <p className="text-xs text-muted-foreground">{m.direction === "entrante" ? `De ${m.fromAddress}` : `Para ${m.toAddress}`} · {formatDate(m.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <aside className="space-y-5">
            <Card>
              <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {c.legalName && <p>{c.legalName}</p>}
                {c.taxId && <p className="text-muted-foreground">NIF {c.taxId}</p>}
                {c.email && <p className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /><a className="text-link hover:underline" href={`mailto:${c.email}`}>{c.email}</a></p>}
                {c.phone && <p className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /><a href={`tel:${c.phone}`}>{c.phone}</a></p>}
                <p className="text-muted-foreground">Pago a {c.paymentTermsDays} días</p>
                {c.tags.length > 0 && <div className="flex flex-wrap gap-1">{c.tags.map((t) => <StatusPill key={t} dot={false}>{t}</StatusPill>)}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Direcciones</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {d.addrs.length === 0 && <p className="text-muted-foreground">Sin direcciones.</p>}
                {d.addrs.map((a) => (
                  <div key={a.id} className="flex gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{a.label}{a.isDefault && <span className="ml-1 text-xs font-normal text-muted-foreground">(principal)</span>}</p>
                      <p>{a.line1}</p>
                      <p className="text-muted-foreground">{[a.postalCode, a.city, a.province].filter(Boolean).join(" ")}</p>
                      {a.lat != null && a.lng != null && <a className="text-xs text-link hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=15/${a.lat}/${a.lng}`}>{a.lat.toFixed(4)}, {a.lng.toFixed(4)} · ver mapa</a>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Personas de contacto</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {d.persons.length === 0 && <p className="text-muted-foreground">Sin personas.</p>}
                {d.persons.map((p) => (
                  <div key={p.id}>
                    <p className="font-medium">{p.name} {p.position && <span className="font-normal text-muted-foreground">· {p.position}</span>}</p>
                    <p className="text-muted-foreground">{[p.email, p.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
              <CardContent><NotesPanel entity="contact" entityId={c.id} path={`/app/contactos/${c.id}`} notes={d.nts.map((n) => ({ id: n.id, body: n.body, authorName: n.authorName, createdAt: n.createdAt.toISOString() }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
              <CardContent><AuditTrail rows={d.audits} /></CardContent>
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
