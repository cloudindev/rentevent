import Link from "next/link";
import { Inbox, Mail } from "lucide-react";
import { and, asc, contacts, desc, emails, emailTemplates, eq, or, orders, projects } from "@rentevent/db";
import { PageHeader } from "@/components/app/page-header";
import { Suspense } from "react";
import { QueryTabs } from "../comunicacion/query-tabs";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { can } from "@/lib/permissions";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { Compose, EmailActions, TemplatesManager } from "./email-client";

export const metadata = { title: "Emails" };

const FILTERS = [
  { key: "", label: "Todos" },
  { key: "noleidos", label: "No leídos" },
  { key: "entrante", label: "Recibidos" },
  { key: "saliente", label: "Enviados" },
];

export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ filtro?: string; id?: string; tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "plantillas" ? "plantillas" : "bandeja";
  const d = await tenantDb(async (tx, ctx) => {
    const where: ReturnType<typeof eq>[] = [];
    if (sp.filtro === "noleidos") where.push(eq(emails.read, false));
    if (sp.filtro === "entrante" || sp.filtro === "saliente") where.push(eq(emails.direction, sp.filtro));
    const selected = sp.id ? (await tx.select().from(emails).where(eq(emails.id, sp.id)))[0] ?? null : null;
    if (selected && !selected.read) await tx.update(emails).set({ read: true }).where(eq(emails.id, selected.id));
    const list = await tx.select().from(emails).where(where.length ? and(...where) : undefined).orderBy(desc(emails.createdAt)).limit(200);
    // replies point at the root message's id; the root itself has no threadId
    const root = selected ? (selected.threadId ?? selected.id) : null;
    const thread = root ? await tx.select().from(emails).where(or(eq(emails.id, root), eq(emails.threadId, root))).orderBy(asc(emails.createdAt)) : [];
    const [os, ps, cs, tpls] = await Promise.all([
      tx.select({ id: orders.id, label: orders.title, number: orders.number }).from(orders).orderBy(desc(orders.periodStart)).limit(200),
      tx.select({ id: projects.id, label: projects.name, number: projects.number }).from(projects).orderBy(desc(projects.startsAt)).limit(200),
      tx.select({ id: contacts.id, label: contacts.name, email: contacts.email }).from(contacts).orderBy(asc(contacts.name)).limit(500),
      tx.select().from(emailTemplates).orderBy(asc(emailTemplates.name)),
    ]);
    return { list, selected, thread, os, ps, cs, tpls, canEdit: can(ctx.role, "comercial") };
  });
  const entityLabel = (e: string | null, id: string | null) => {
    if (!e || !id) return null;
    if (e === "order") {
      const o = d.os.find((x) => x.id === id);
      return o ? { label: `Pedido ${o.number} · ${o.label}`, href: `/app/pedidos/${id}` } : null;
    }
    if (e === "project") {
      const p = d.ps.find((x) => x.id === id);
      return p ? { label: `Proyecto ${p.number} · ${p.label}`, href: `/app/proyectos/${id}` } : null;
    }
    if (e === "contact") {
      const c = d.cs.find((x) => x.id === id);
      return c ? { label: c.label, href: `/app/contactos/${id}` } : null;
    }
    return null;
  };
  const unread = d.list.filter((m) => !m.read).length;
  const link = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ filtro: sp.filtro, ...params })) if (v) q.set(k, v);
    return `/app/emails${q.toString() ? `?${q}` : ""}`;
  };
  const entities = { orders: d.os.map((o) => ({ id: o.id, label: `${o.number} · ${o.label}` })), projects: d.ps.map((p) => ({ id: p.id, label: `${p.number} · ${p.label}` })), contacts: d.cs.map((c) => ({ id: c.id, label: c.label, email: c.email })) };
  const templates = d.tpls.map((t) => ({ id: t.id, key: t.key, name: t.name, subject: t.subject, body: t.body }));
  return (
    <>
      <PageHeader icon={Mail} title="Emails" subtitle={unread ? `${unread} sin leer` : undefined}>
        {d.canEdit && <Compose templates={templates} entities={entities} />}
      </PageHeader>
      <Suspense>
        <QueryTabs base="/app/emails" tabs={[{ key: "", label: "Bandeja compartida" }, { key: "plantillas", label: "Plantillas" }]} />
      </Suspense>
      {tab === "plantillas" ? (
        <div className="mx-auto max-w-4xl p-4 md:p-6">
          <TemplatesManager templates={templates} canEdit={d.canEdit} />
        </div>
      ) : (
        <div className="grid min-h-[calc(100%-110px)] lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="border-b lg:border-b-0 lg:border-r">
            <nav className="flex gap-1 border-b p-2" aria-label="Filtros">
              {FILTERS.map((f) => (
                <Link key={f.key} href={link({ filtro: f.key || undefined, id: undefined })} className={cn("rounded-full px-3 py-1 text-[13px] text-muted-foreground hover:bg-accent", (sp.filtro ?? "") === f.key && "bg-accent font-medium text-foreground")}>
                  {f.label}
                </Link>
              ))}
            </nav>
            {d.list.length === 0 ? (
              <EmptyState icon={Inbox} title="Bandeja vacía" description="Los correos enviados desde Rentevent y los recibidos por el buzón conectado aparecen aquí." className="m-4" />
            ) : (
              <ul className="max-h-[70vh] divide-y overflow-y-auto">
                {d.list.map((m) => (
                  <li key={m.id}>
                    <Link href={link({ id: m.id })} className={cn("block px-4 py-3 hover:bg-subtle", d.selected?.id === m.id && "bg-accent")}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", !m.read && "font-semibold")}>{m.direction === "entrante" ? m.fromAddress : `Para: ${m.toAddress}`}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(m.createdAt, { day: "numeric", month: "short" })}</span>
                      </div>
                      <p className={cn("truncate text-sm", !m.read ? "text-foreground" : "text-foreground/80")}>
                        {!m.read && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-brand-500 align-middle" aria-label="No leído" />}
                        {m.subject}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.body.slice(0, 120)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
          <section className="min-w-0 p-4 md:p-6">
            {!d.selected ? (
              <EmptyState icon={Mail} title="Selecciona un correo" description="Cada correo puede vincularse a su pedido, proyecto o contacto para verlo en su historial." />
            ) : (
              <article className="space-y-4">
                <header className="space-y-2">
                  <h2 className="text-lg font-semibold">{d.selected.subject}</h2>
                  <p className="text-sm text-muted-foreground">
                    {d.selected.direction === "entrante" ? "De" : "Para"} <span className="text-foreground">{d.selected.direction === "entrante" ? d.selected.fromAddress : d.selected.toAddress}</span> · {formatDateTime(d.selected.createdAt)}
                    {d.selected.status === "simulado" && <> · <StatusPill dot={false}>envío simulado</StatusPill></>}
                  </p>
                  {(() => {
                    const e = entityLabel(d.selected.entity, d.selected.entityId);
                    return e ? (
                      <Link href={e.href} className="inline-flex rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent">{e.label} →</Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin vincular</span>
                    );
                  })()}
                </header>
                {d.thread.length > 1 && (
                  <div className="space-y-2">
                    {d.thread.filter((t) => t.id !== d.selected!.id).map((t) => (
                      <details key={t.id} className="rounded-lg border px-3 py-2 text-sm">
                        <summary className="cursor-pointer text-muted-foreground">{t.direction === "entrante" ? t.fromAddress : `Respuesta a ${t.toAddress}`} · {formatDateTime(t.createdAt)}</summary>
                        <p className="mt-2 whitespace-pre-wrap">{t.body}</p>
                      </details>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-relaxed">{d.selected.body}</div>
                <EmailActions
                  email={{ id: d.selected.id, direction: d.selected.direction, from: d.selected.fromAddress, to: d.selected.toAddress, subject: d.selected.subject, entity: d.selected.entity, entityId: d.selected.entityId }}
                  entities={entities}
                  templates={templates}
                  canEdit={d.canEdit}
                />
              </article>
            )}
          </section>
        </div>
      )}
    </>
  );
}
