import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Navigation } from "lucide-react";
import { asc, contacts, desc, eq, projects, venues } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { navigationUrl } from "@/lib/adapters/maps";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { GROUND_LABELS } from "../venue-form";
import { VenueActions, PlanUpload } from "./client";

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tenantDb(async (tx, ctx) => {
    const [v] = await tx.select().from(venues).where(eq(venues.id, id));
    if (!v) return null;
    const [ps, cs] = await Promise.all([
      tx.select({ id: projects.id, name: projects.name, number: projects.number, status: projects.status, startsAt: projects.startsAt }).from(projects).where(eq(projects.venueId, id)).orderBy(desc(projects.startsAt)).limit(20),
      tx.select({ id: contacts.id, name: contacts.name }).from(contacts).orderBy(asc(contacts.name)),
    ]);
    return { v, ps, cs, canEdit: can(ctx.role, "comercial") };
  });
  if (!data) notFound();
  const { v } = data;
  const owner = data.cs.find((c) => c.id === v.contactId);
  return (
    <>
      <PageHeader icon={MapPin} title={v.name} back={{ href: "/app/espacios", label: "Espacios" }}>
        {v.anchoringAllowed ? <StatusPill tone="success">Anclaje permitido</StatusPill> : <StatusPill tone="warning">Solo pesos</StatusPill>}
        {data.canEdit && (
          <VenueActions
            contacts={data.cs}
            initial={{ id: v.id, name: v.name, address: v.address, city: v.city, contactId: v.contactId, groundType: v.groundType as "cesped", anchoringAllowed: v.anchoringAllowed, accessNotes: v.accessNotes ?? "", restrictions: v.restrictions ?? "", maxVehicle: v.maxVehicle ?? "", metresPerPixel: v.metresPerPixel }}
          />
        )}
      </PageHeader>
      <PageBody>
        {!v.anchoringAllowed && <p className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm text-warning">En este espacio no se puede perforar: configura las carpas con fijación por pesos.</p>}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{[v.address, v.city].filter(Boolean).join(", ") || "Sin dirección"}</p>
              {v.lat != null && v.lng != null ? (
                <a className="inline-flex items-center gap-1 text-link hover:underline" href={navigationUrl(v.lat, v.lng)} target="_blank" rel="noreferrer">
                  <Navigation className="size-3.5" /> Cómo llegar ({v.lat.toFixed(4)}, {v.lng.toFixed(4)})
                </a>
              ) : (
                <p className="text-xs text-warning">Sin geolocalizar: edita la dirección.</p>
              )}
              <p>
                <span className="text-muted-foreground">Suelo:</span> {GROUND_LABELS[v.groundType] ?? v.groundType}
              </p>
              <p>
                <span className="text-muted-foreground">Vehículo máximo:</span> {v.maxVehicle ?? "Sin límite"}
              </p>
              <p>
                <span className="text-muted-foreground">Propietario:</span> {owner ? <Link className="text-link hover:underline" href={`/app/contactos/${owner.id}`}>{owner.name}</Link> : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Accesos y restricciones</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Accesos</p>
                <p className="whitespace-pre-line">{v.accessNotes || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Restricciones</p>
                <p className="whitespace-pre-line">{v.restrictions || "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Plano del recinto</CardTitle>
              <p className="text-xs text-muted-foreground">Se usa en el configurador para colocar las carpas a escala.</p>
            </div>
            {data.canEdit && <PlanUpload venueId={v.id} metresPerPixel={v.metresPerPixel} />}
          </CardHeader>
          <CardContent>
            {v.planImageUrl ? (
              <figure>
                <img src={v.planImageUrl} alt={`Plano de ${v.name}`} className="max-h-[480px] w-full rounded-lg border object-contain" />
                <figcaption className="mt-2 text-xs text-muted-foreground">{v.metresPerPixel ? `Escala: 1 px = ${v.metresPerPixel} m` : "Sin escala definida"}</figcaption>
              </figure>
            ) : (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Sin plano. Sube una imagen del recinto o una captura de satélite.</p>
            )}
          </CardContent>
        </Card>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Proyectos en este espacio</h2>
          {data.ps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ningún proyecto todavía.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Proyecto</TH>
                  <TH>Fecha</TH>
                  <TH>Estado</TH>
                </TR>
              </THead>
              <TBody>
                {data.ps.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Link className="font-medium hover:underline" href={`/app/proyectos/${p.id}`}>
                        {p.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{p.number}</span>
                    </TD>
                    <TD>{formatDate(p.startsAt)}</TD>
                    <TD>
                      <StatusPill tone={p.status === "confirmado" || p.status === "en_curso" ? "success" : p.status === "opcion" ? "warning" : p.status === "cancelado" ? "danger" : "neutral"}>{p.status.replace("_", " ")}</StatusPill>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </section>
      </PageBody>
    </>
  );
}
