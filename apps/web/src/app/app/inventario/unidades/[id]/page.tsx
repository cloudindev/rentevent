import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowDownLeft, ArrowUpRight, Box, CircleDot, ClipboardCheck, MapPin, Package, PackageOpen, PackagePlus, Plus, Printer, Truck, Wrench, X } from "lucide-react";
import { and, asc, eq, items, ne } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { CONTAINER_LABEL, labelUrl, UNIT_EVENT_LABEL, UNIT_STATUS_LABEL, UNIT_STATUS_TONE, unitWhere } from "@/server/warehouse/logic";
import { unitDetail } from "@/server/warehouse/tracking";
import { ContainerPanel, UnitActions, UnpackButton } from "./unit-client";

export const metadata = { title: "Unidad" };

const EVENT_ICON: Record<string, typeof Box> = {
  alta: Plus,
  salida: ArrowUpRight,
  retorno: ArrowDownLeft,
  danado: Wrench,
  perdido: X,
  reparacion: Wrench,
  limpieza: Wrench,
  reparado: ClipboardCheck,
  baja: X,
  revision: ClipboardCheck,
  traslado: MapPin,
  empaquetado: PackagePlus,
  desempaquetado: PackageOpen,
  contenido: Package,
  estado: CircleDot,
};

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await tenantDb(async (tx, ctx) => {
    const d = await unitDetail(tx, id);
    if (!d) return null;
    const bulkItems = d.item.container
      ? await tx.select({ id: items.id, name: items.name, sku: items.sku }).from(items).where(and(eq(items.active, true), ne(items.kind, "seriado"), ne(items.kind, "servicio"))).orderBy(asc(items.name))
      : [];
    return { ...d, bulkItems, role: ctx.role };
  });
  if (!data) notFound();
  const { unit, item } = data;
  const qr = await QRCode.toDataURL(labelUrl(env.appUrl, unit.qrCode), { margin: 1, width: 360 });
  const canWarehouse = can(data.role, "almacen");
  const where = unitWhere({ status: unit.status, parent: data.parent, order: data.order, warehouseName: data.warehouseName, shelf: data.shelf });
  const nextInspection = unit.lastInspectionAt && item.inspectionIntervalDays ? new Date(unit.lastInspectionAt.getTime() + item.inspectionIntervalDays * 86_400_000) : null;
  return (
    <>
      <PageHeader icon={item.container ? Box : Package} title={unit.serial} subtitle={item.name} back={{ href: "/app/inventario/unidades", label: "Unidades" }}>
        <Button asChild variant="outline" size="sm">
          <a href={`/app/inventario/etiquetas?unit=${unit.id}`} target="_blank" rel="noreferrer">
            <Printer /> Etiqueta
          </a>
        </Button>
        <UnitActions
          unit={{ id: unit.id, serial: unit.serial, status: unit.status, notes: unit.notes, warehouseId: unit.warehouseId ?? item.warehouseId, location: data.shelf, packed: Boolean(unit.parentUnitId) }}
          warehouses={data.warehouses}
          canEdit={can(data.role, "inventario")}
          canWarehouse={canWarehouse}
        />
      </PageHeader>
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Estado</p>
                <StatusPill className="mt-2" tone={UNIT_STATUS_TONE[unit.status] ?? "neutral"}>
                  {UNIT_STATUS_LABEL[unit.status] ?? unit.status}
                </StatusPill>
              </Card>
              <Card className="p-4 sm:col-span-2">
                <p className="text-xs text-muted-foreground">Dónde está</p>
                <p className="mt-1 font-medium">{where}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.parent && (
                    <Link className="text-link hover:underline" href={`/app/inventario/unidades/${data.parent.id}`}>
                      Abrir {data.parent.serial}
                    </Link>
                  )}
                  {data.order && (
                    <Link className="text-link hover:underline" href={`/app/pedidos/${data.order.id}`}>
                      Ver pedido {data.order.number}
                    </Link>
                  )}
                  {!data.parent && !data.order && unit.lastSeenAt && `Último escaneo ${formatDateTime(unit.lastSeenAt)}`}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Revisión</p>
                <p className="mt-1 font-medium">{unit.lastInspectionAt ? formatDate(unit.lastInspectionAt) : "Sin revisar"}</p>
                {nextInspection && <p className="text-xs text-muted-foreground">Próxima {formatDate(nextInspection)}</p>}
              </Card>
            </div>

            {item.container && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Contenido · {CONTAINER_LABEL[item.container]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.children.length + data.bulk.length === 0 && <p className="text-sm text-muted-foreground">Vacío. Escanea o escribe el código de las unidades que van dentro, y añade lo que no lleva número de serie (baterías, cables…).</p>}
                  {data.children.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                      {data.children.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          {c.container ? <Box className="size-4 text-muted-foreground" /> : <Package className="size-4 text-muted-foreground" />}
                          <Link href={`/app/inventario/unidades/${c.id}`} className="font-medium hover:underline">
                            {c.serial}
                          </Link>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.name}</span>
                          <StatusPill tone={UNIT_STATUS_TONE[c.status] ?? "neutral"}>{UNIT_STATUS_LABEL[c.status] ?? c.status}</StatusPill>
                          {canWarehouse && <UnpackButton unitId={c.id} serial={c.serial} />}
                        </li>
                      ))}
                    </ul>
                  )}
                  <ContainerPanel containerId={unit.id} bulk={data.bulk} items={data.bulkItems} canEdit={canWarehouse} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Historial</CardTitle>
              </CardHeader>
              <CardContent>
                {data.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin movimientos registrados todavía. Aparecerán aquí las salidas, vueltas, cambios de caja, reparaciones y revisiones.</p>
                ) : (
                  <ol className="relative space-y-4 border-l pl-5">
                    {data.events.map((e) => {
                      const Icon = EVENT_ICON[e.kind] ?? CircleDot;
                      return (
                        <li key={e.id} className="relative">
                          <span className="absolute -left-[31px] top-0 flex size-5 items-center justify-center rounded-full border bg-background">
                            <Icon className="size-3 text-muted-foreground" />
                          </span>
                          <p className="text-sm font-medium">
                            {UNIT_EVENT_LABEL[e.kind] ?? e.kind}
                            {e.note && <span className="font-normal text-muted-foreground"> · {e.note}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(e.createdAt)}
                            {e.userName && ` · ${e.userName}`}
                            {e.orderId && (
                              <>
                                {" · "}
                                <Link className="text-link hover:underline" href={`/app/pedidos/${e.orderId}`}>
                                  <Truck className="mr-0.5 inline size-3" />
                                  pedido
                                </Link>
                              </>
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>

            {data.repairs.length + data.inspections.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Reparaciones y revisiones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {data.repairs.map((r) => (
                    <p key={r.id} className="flex justify-between gap-3">
                      <span>
                        {r.kind === "limpieza" ? "Limpieza" : "Reparación"} · {r.reason} <span className="text-muted-foreground">· {formatDate(r.createdAt)}</span>
                      </span>
                      <StatusPill tone={r.status === "reparado" ? "success" : r.status === "baja" ? "neutral" : "warning"}>{r.status.replace("_", " ")}</StatusPill>
                    </p>
                  ))}
                  {data.inspections.map((i) => (
                    <p key={i.id} className="flex justify-between gap-3">
                      <span>
                        Revisión {formatDate(i.inspectedAt)} {i.inspector && <span className="text-muted-foreground">· {i.inspector}</span>}
                      </span>
                      <StatusPill tone={i.result === "ok" ? "success" : i.result === "defectos" ? "warning" : "danger"}>{i.result.replace("_", " ")}</StatusPill>
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-4 text-center">
              <img src={qr} alt={`Código QR de ${unit.serial}`} className="mx-auto aspect-square w-full max-w-56 rounded-lg border bg-white p-2" />
              <p className="mt-3 font-mono text-xs text-muted-foreground">{unit.qrCode}</p>
              <p className="mt-1 text-xs text-muted-foreground">Al escanearlo con la cámara del móvil se abre esta ficha.</p>
            </Card>
            <Card className="space-y-2 p-4 text-sm">
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Artículo</span>
                <Link href={`/app/inventario/${item.id}`} className="truncate text-link hover:underline">
                  {item.sku}
                </Link>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Categoría</span>
                <span>{item.category}</span>
              </p>
              {unit.purchasedAt && (
                <p className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Compra</span>
                  <span>{formatDate(unit.purchasedAt)}</span>
                </p>
              )}
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Alta</span>
                <span>{formatDate(unit.createdAt)}</span>
              </p>
              {item.container && (
                <p className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Lleva dentro</span>
                  <span className="tabular">
                    {formatNumber(data.children.length)} uds{data.bulk.length ? ` + ${formatNumber(data.bulk.reduce((s, b) => s + b.quantity, 0))} a granel` : ""}
                  </span>
                </p>
              )}
              {unit.notes && <p className="border-t pt-2 text-muted-foreground">{unit.notes}</p>}
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
