import Link from "next/link";
import { Bell, MessageSquare, Pin, StickyNote } from "lucide-react";
import { and, asc, announcements, desc, eq, notes, notifications, workers } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Suspense } from "react";
import { QueryTabs } from "./query-tabs";
import { StatusPill, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/permissions";
import { cn, formatDateTime, initials } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { AnnouncementActions, NewAnnouncement, NoticeComposer } from "./comms-client";

export const metadata = { title: "Comunicación" };

const ENTITY_HREF: Record<string, (id: string) => string> = { order: (id) => `/app/pedidos/${id}`, project: (id) => `/app/proyectos/${id}`, contact: (id) => `/app/contactos/${id}`, item: (id) => `/app/inventario/${id}` };
const ENTITY_LABEL: Record<string, string> = { order: "Pedido", project: "Proyecto", contact: "Contacto", item: "Artículo" };
const STATUS_TONE: Record<string, Tone> = { enviada: "success", simulada: "neutral", error: "danger", sin_dispositivo: "warning" };
const CHANNEL_LABEL: Record<string, string> = { push: "Push", email: "Correo", whatsapp: "WhatsApp", interno: "Interno" };

export default async function CommsPage({ searchParams }: { searchParams: Promise<{ tab?: string; canal?: string; estado?: string }> }) {
  const sp = await searchParams;
  const tab = ["notas", "registro", "enviar"].includes(sp.tab ?? "") ? sp.tab! : "avisos";
  const d = await tenantDb(async (tx, ctx) => {
    const filters: ReturnType<typeof eq>[] = [];
    if (sp.canal) filters.push(eq(notifications.channel, sp.canal));
    if (sp.estado) filters.push(eq(notifications.status, sp.estado));
    return {
      ann: await tx.select().from(announcements).orderBy(desc(announcements.pinned), desc(announcements.createdAt)).limit(100),
      notes: tab === "notas" ? await tx.select().from(notes).orderBy(desc(notes.createdAt)).limit(150) : [],
      notifs: tab === "registro" ? await tx.select().from(notifications).where(filters.length ? and(...filters) : undefined).orderBy(desc(notifications.createdAt)).limit(300) : [],
      team: tab === "enviar" ? await tx.select({ id: workers.id, name: workers.name, email: workers.email, phone: workers.phone, skills: workers.skills }).from(workers).where(eq(workers.active, true)).orderBy(asc(workers.name)) : [],
      canSend: can(ctx.role, "personal"),
    };
  });
  const q = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams({ tab: "registro" });
    for (const [k, v] of Object.entries({ canal: sp.canal, estado: sp.estado, ...params })) if (v) s.set(k, v);
    return `/app/comunicacion?${s}`;
  };
  return (
    <>
      <PageHeader icon={MessageSquare} title="Comunicación">
        {tab === "avisos" && <NewAnnouncement />}
      </PageHeader>
      <Suspense>
        <QueryTabs
          base="/app/comunicacion"
          tabs={[
            { key: "", label: "Avisos al equipo" },
            { key: "notas", label: "Notas internas" },
            { key: "registro", label: "Registro de notificaciones" },
            ...(d.canSend ? [{ key: "enviar", label: "Enviar aviso" }] : []),
          ]}
        />
      </Suspense>
      <PageBody className="max-w-5xl">
        {tab === "avisos" &&
          (d.ann.length === 0 ? (
            <EmptyState icon={Pin} title="Sin avisos" description="Publica avisos para todo el equipo: normas de seguridad, cambios de nave, novedades." />
          ) : (
            <ul className="space-y-3">
              {d.ann.map((a) => (
                <li key={a.id} className={cn("rounded-xl border bg-card p-4", a.pinned && "border-brand-200 dark:border-brand-900")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 font-semibold">
                        {a.pinned && <Pin className="size-4 text-brand-600" aria-label="Fijado" />}
                        {a.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">{a.authorName} · {formatDateTime(a.createdAt)}</p>
                    </div>
                    <AnnouncementActions a={{ id: a.id, title: a.title, body: a.body, pinned: a.pinned }} />
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>
                </li>
              ))}
            </ul>
          ))}
        {tab === "notas" &&
          (d.notes.length === 0 ? (
            <EmptyState icon={StickyNote} title="Sin notas" description="Las notas internas de pedidos, proyectos y contactos aparecen aquí, de la más reciente a la más antigua." />
          ) : (
            <ul className="space-y-3">
              {d.notes.map((n) => (
                <li key={n.id} className="flex gap-3 rounded-xl border bg-card p-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">{initials(n.authorName ?? "?")}</span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{n.authorName}</span> · {formatDateTime(n.createdAt)} ·{" "}
                      {ENTITY_HREF[n.entity] ? <Link className="text-link hover:underline" href={ENTITY_HREF[n.entity]!(n.entityId)}>{ENTITY_LABEL[n.entity] ?? n.entity}</Link> : n.entity}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          ))}
        {tab === "registro" && (
          <div className="space-y-3">
            <nav className="flex flex-wrap gap-1.5" aria-label="Filtros">
              {[undefined, "push", "email", "whatsapp", "interno"].map((c) => (
                <Link key={c ?? "all"} href={q({ canal: c })} className={cn("rounded-full border px-3 py-1 text-[13px]", (sp.canal ?? undefined) === c ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>
                  {c ? CHANNEL_LABEL[c] : "Todos los canales"}
                </Link>
              ))}
              <span className="mx-1 w-px bg-border" />
              {[undefined, "enviada", "simulada", "error"].map((s) => (
                <Link key={s ?? "all"} href={q({ estado: s })} className={cn("rounded-full border px-3 py-1 text-[13px]", (sp.estado ?? undefined) === s ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent")}>
                  {s ?? "Todos los estados"}
                </Link>
              ))}
            </nav>
            {d.notifs.length === 0 ? (
              <EmptyState icon={Bell} title="Sin notificaciones" description="Aquí queda registro de cada aviso enviado por push, correo, WhatsApp o internamente." />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Fecha</TH>
                    <TH>Canal</TH>
                    <TH>Destinatario</TH>
                    <TH>Mensaje</TH>
                    <TH>Estado</TH>
                  </TR>
                </THead>
                <TBody>
                  {d.notifs.map((n) => (
                    <TR key={n.id}>
                      <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(n.createdAt)}</TD>
                      <TD>{CHANNEL_LABEL[n.channel] ?? n.channel}</TD>
                      <TD>{n.recipient}</TD>
                      <TD>
                        <p className="font-medium">{n.title}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                        {n.entity && n.entityId && ENTITY_HREF[n.entity] && <Link className="text-xs text-link hover:underline" href={ENTITY_HREF[n.entity]!(n.entityId)}>{ENTITY_LABEL[n.entity]}</Link>}
                      </TD>
                      <TD><StatusPill tone={STATUS_TONE[n.status] ?? "neutral"}>{n.status.replace("_", " ")}</StatusPill></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </div>
        )}
        {tab === "enviar" && d.canSend && <NoticeComposer team={d.team} />}
      </PageBody>
    </>
  );
}
