"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Award, CheckCheck, FileSignature, Minus, Plus, ScanLine, Truck, Warehouse, X } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader, DateChip } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Switch } from "@/components/ui/menu";
import { QrScanner } from "@/components/crew/qr-scanner";
import { Progress } from "@/components/warehouse/progress";
import { cn, formatDateTime, formatNumber, formatRange } from "@/lib/utils";
import { closeReturn, createDeliveryNote, markAll, markLoaded, scanCode, updatePickLine } from "@/server/actions/warehouse";
import { OpenListButton } from "../open-list-button";
import { PICK_STATUS_LABEL, PICK_STATUS_TONE, groupByLocation, listStatus, progress, type PickStatus } from "@/server/warehouse/logic";

type Line = { id: string; itemId: string; name: string; sku: string; unit: string; kind: string; role: string; category: string; location: string | null; quantity: number; prepared: number; loaded: number; returned: number; damaged: number; lost: number; status: string; scannedUnits: string[] };
type Field = "prepared" | "loaded" | "returned" | "damaged" | "lost";

function Counter({ value, max, onChange, label, disabled, tone }: { value: number; max: number; onChange: (v: number) => void; label: string; disabled?: boolean; tone?: "danger" | "warning" }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Restar ${label}`} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}>
        <Minus />
      </Button>
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={value}
        min={0}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("tabular h-8 w-14 rounded-md border bg-background text-center text-sm", tone === "danger" && value > 0 && "border-danger/50 text-danger", tone === "warning" && value > 0 && "border-warning/50 text-warning")}
      />
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Sumar ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <Plus />
      </Button>
    </div>
  );
}

export function PickListDetail({ list, order, clientName, lines: initial, note, canWork, latest = true, initialCode }: { list: { id: string; kind: "salida" | "retorno"; status: string; dueAt: string | null }; order: { id: string; number: string; title: string; status: string; periodStart: string; periodEnd: string } | null; clientName: string | null; lines: Line[]; note: { id: string; number: string; signed: boolean } | null; canWork: boolean; latest?: boolean; initialCode?: string | null }) {
  const router = useRouter();
  const [lines, setLines] = useState(initial);
  const [scan, setScan] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [missingAsLost, setMissingAsLost] = useState(false);
  const [pending, start] = useTransition();
  const isOut = list.kind === "salida";
  const closed = list.status === "en_obra" || (!isOut && list.status === "devuelto");
  const editable = canWork && !closed;
  const status = (closed ? (isOut ? "en_obra" : "devuelto") : listStatus(lines, list.kind, { dueAt: list.dueAt ? new Date(list.dueAt) : null })) as PickStatus;
  const pct = closed ? 100 : progress(lines, list.kind);
  const groups = useMemo(() => groupByLocation(lines), [lines]);
  const fabrics = (l: Line) => l.category === "Lonas" || l.role.startsWith("lona") || l.role.startsWith("lateral") || l.role.startsWith("frontal") || l.role === "pico";

  const set = (l: Line, field: Field, raw: number) => {
    const v = Math.max(0, Math.round(raw * 100) / 100);
    setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, [field]: v, ...(field === "loaded" && v > x.prepared ? { prepared: v } : {}) } : x)));
    start(async () => {
      const r = await updatePickLine({ lineId: l.id, field, value: v });
      if (!r.ok) {
        toast.error(r.error);
        router.refresh();
        return;
      }
      if (r.data.value !== v) setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, [field]: r.data.value } : x)));
    });
  };

  const onScan = (code: string) =>
    start(async () => {
      const r = await scanCode({ listId: list.id, code });
      if (!r.ok) {
        toast.error(r.error);
        setLastScan(`✕ ${r.error}`);
        return;
      }
      setLastScan(`✓ ${r.data.message}${r.data.warnings.length ? ` · ${r.data.warnings.join(" · ")}` : ""}`);
      if (r.data.warnings.length) toast.warning(r.data.warnings.join("\n"));
      else if (!scan) toast.success(r.data.message); // scanned from the phone: the inline result is not visible
      if ("vibrate" in navigator) navigator.vibrate?.(40);
      router.refresh();
      const upd = new Map(r.data.lines.map((u) => [u.id, u]));
      setLines((ls) => ls.map((x) => { const u = upd.get(x.id); return u ? { ...x, [r.data.field]: u.count, scannedUnits: u.scannedUnits } : x; }));
    });

  const consumed = useRef(false);
  useEffect(() => {
    if (initialCode && editable && !consumed.current) {
      consumed.current = true;
      onScan(initialCode);
      router.replace(`/app/almacen/${list.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const damagedTotal = lines.reduce((s, l) => s + l.damaged, 0);
  const lostTotal = lines.reduce((s, l) => s + l.lost, 0);
  const missingTotal = lines.reduce((s, l) => s + Math.max(0, l.quantity - l.returned - l.damaged - l.lost), 0);

  return (
    <>
      <PageHeader icon={Warehouse} title={`${isOut ? "Carga" : "Retorno"} · ${order ? `${order.number} ${order.title}` : "Pedido"}`} back={{ href: isOut ? "/app/almacen" : "/app/almacen/retornos", label: "Almacén" }}>
        {list.dueAt && <DateChip>{formatDateTime(list.dueAt)}</DateChip>}
        <StatusPill tone={PICK_STATUS_TONE[status]}>{PICK_STATUS_LABEL[status]}</StatusPill>
      </PageHeader>
      <PageBody className="max-w-5xl">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <div className="min-w-0 flex-1 basis-full lg:basis-[320px]">
            <p className="text-sm">
              {clientName ?? "Sin cliente"} · {order ? formatRange(order.periodStart, order.periodEnd) : ""}
              {order && (
                <Link className="ml-2 text-link hover:underline" href={`/app/pedidos/${order.id}`}>
                  Ver pedido
                </Link>
              )}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={pct} tone={status === "retrasado" ? "danger" : pct === 100 ? "success" : "default"} />
              <span className="tabular text-xs text-muted-foreground">{pct}%</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lines.length} artículos · {formatNumber(total)} unidades
              {!isOut && (damagedTotal || lostTotal) ? ` · ${damagedTotal} dañadas · ${lostTotal} perdidas` : ""}
            </p>
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button variant={scan ? "secondary" : "outline"} size="sm" onClick={() => setScan((s) => !s)}>
                {scan ? <X /> : <ScanLine />} {scan ? "Cerrar escáner" : "Escanear"}
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await markAll({ listId: list.id, field: isOut ? "prepared" : "returned" }); if (!r.ok) { toast.error(r.error); return; } router.refresh(); setLines((ls) => ls.map((l) => (isOut ? { ...l, prepared: l.quantity } : { ...l, returned: Math.max(0, l.quantity - l.damaged - l.lost) }))); })}>
                <CheckCheck /> {isOut ? "Todo preparado" : "Todo devuelto"}
              </Button>
              {isOut ? (
                <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await markLoaded({ listId: list.id }); if (!r.ok) { toast.error(r.error); return; } toast.success(r.data.incomplete ? `Carga registrada con ${r.data.incomplete} líneas incompletas` : "Carga registrada: material en obra"); router.refresh(); })}>
                  <Truck /> Marcar cargado
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCloseOpen(true)}>
                  <CheckCheck /> Cerrar retorno
                </Button>
              )}
            </div>
          )}
          {canWork && closed && !isOut && latest && order?.status === "en_curso" && missingTotal > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-warning">Faltan {formatNumber(missingTotal)} por volver</span>
              <OpenListButton orderId={order.id} kind="retorno" label="Recibir lo pendiente" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {note ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/app/almacen/albaranes/${note.id}`}>
                  <FileSignature /> {note.number}
                  {note.signed ? " · firmado" : " · sin firmar"}
                </Link>
              </Button>
            ) : (
              canWork && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await createDeliveryNote({ listId: list.id }); if (!r.ok) { toast.error(r.error); return; } router.push(`/app/almacen/albaranes/${r.data.id}`); })}>
                  <FileSignature /> Albarán de {isOut ? "entrega" : "recogida"}
                </Button>
              )
            )}
            {order && (
              <Button asChild size="sm" variant="ghost">
                <a href={`/app/almacen/certificado/${order.id}/pdf`} target="_blank" rel="noreferrer">
                  <Award /> Certificado de instalación
                </a>
              </Button>
            )}
          </div>
        </div>

        {scan && editable && (
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <QrScanner onScan={onScan} paused={pending} />
            {lastScan && <p className={cn("text-sm", lastScan.startsWith("✕") ? "text-danger" : "text-success")} aria-live="polite">{lastScan}</p>}
            <p className="text-xs text-muted-foreground">Escanea el QR de cada unidad, de una caja o conjunto (cuenta todo lo que lleva dentro) o el código del artículo (SKU). En el móvil también puedes usar <Link className="text-link underline" href={`/m/escanear?volver=/app/almacen/${list.id}`}>el escáner de la app</Link>.</p>
          </section>
        )}

        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">La lista no tiene líneas.</p>
        ) : (
          groups.map((g) => (
            <section key={g.location} className="overflow-hidden rounded-xl border bg-card">
              <h2 className="border-b bg-subtle px-4 py-2 text-[13px] font-medium text-muted-foreground">{g.location}</h2>
              <ul className="divide-y">
                {g.lines.map((l) => {
                  const done = isOut ? l.loaded >= l.quantity || (closed && true) : l.returned + l.damaged + l.lost >= l.quantity;
                  return (
                    <li key={l.id} className={cn("grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center", done && "bg-success-bg/30")}>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {l.name} <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{l.sku}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {l.location ?? "Sin ubicación"} · {formatNumber(l.quantity)} {l.unit === "m2" ? "m²" : "uds"}
                          {l.scannedUnits.length > 0 && ` · ${l.scannedUnits.length} escaneadas`}
                        </p>
                      </div>
                      {isOut ? (
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">Preparado <Counter label={`preparado ${l.name}`} value={l.prepared} max={l.quantity} disabled={!editable} onChange={(v) => set(l, "prepared", v)} /></span>
                          <span className="flex items-center gap-1.5">Cargado <Counter label={`cargado ${l.name}`} value={l.loaded} max={l.quantity} disabled={!editable} onChange={(v) => set(l, "loaded", v)} /></span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">Vuelve <Counter label={`devuelto ${l.name}`} value={l.returned} max={l.quantity - l.damaged - l.lost} disabled={!editable} onChange={(v) => set(l, "returned", v)} /></span>
                          <span className="flex items-center gap-1.5">Daño <Counter tone="warning" label={`dañado ${l.name}`} value={l.damaged} max={l.quantity - l.returned - l.lost} disabled={!editable} onChange={(v) => set(l, "damaged", v)} /></span>
                          <span className="flex items-center gap-1.5">Pérdida <Counter tone="danger" label={`perdido ${l.name}`} value={l.lost} max={l.quantity - l.returned - l.damaged} disabled={!editable} onChange={(v) => set(l, "lost", v)} /></span>
                          {fabrics(l) && editable && (
                            <label className="flex items-center gap-1.5">
                              <Checkbox checked={dirty.has(l.id)} onCheckedChange={(v) => setDirty((s) => { const n = new Set(s); if (v) n.add(l.id); else n.delete(l.id); return n; })} /> Sucia
                            </label>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </PageBody>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar retorno</DialogTitle>
            <DialogDescription>Se registran los movimientos. Lo dañado pasa a reparación y lo marcado como sucio a limpieza: en ambos casos deja de estar disponible hasta que se cierre.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Devuelto</dt>
            <dd className="tabular text-right">{formatNumber(lines.reduce((s, l) => s + l.returned, 0))}</dd>
            <dt className="text-muted-foreground">A reparación</dt>
            <dd className="tabular text-right">{formatNumber(damagedTotal)}</dd>
            <dt className="text-muted-foreground">Lonas a limpieza</dt>
            <dd className="tabular text-right">{dirty.size} líneas</dd>
            <dt className="text-muted-foreground">Perdido</dt>
            <dd className="tabular text-right">{formatNumber(lostTotal)}</dd>
            <dt className="text-muted-foreground">Sin contar</dt>
            <dd className={cn("tabular text-right", missingTotal > 0 && "text-warning")}>{formatNumber(missingTotal)}</dd>
          </dl>
          {missingTotal > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={missingAsLost} onCheckedChange={setMissingAsLost} /> Dar por perdido lo que falta (si no, el pedido sigue en obra y podrás recibirlo después con «Recibir lo pendiente»)
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancelar</Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await closeReturn({ listId: list.id, missingAsLost, lines: lines.map((l) => ({ lineId: l.id, returned: l.returned, damaged: l.damaged, lost: l.lost, dirty: dirty.has(l.id) })) });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success(r.data.orderReturned ? "Retorno cerrado: pedido devuelto" : "Retorno cerrado con material pendiente: recíbelo con «Recibir lo pendiente»");
                  setCloseOpen(false);
                  router.refresh();
                })
              }
            >
              Cerrar retorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
