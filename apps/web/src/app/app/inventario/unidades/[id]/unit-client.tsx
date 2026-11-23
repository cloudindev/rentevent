"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, MoreHorizontal, PackageOpen, PackagePlus, Pencil, ScanLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { QrScanner } from "@/components/crew/qr-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { formatNumber } from "@/lib/utils";
import { moveUnit, packUnit, saveUnitNotes, setUnitContent, setUnitStatus, unpackUnit } from "@/server/actions/inventory";
import { UNIT_STATUS_LABEL } from "@/server/warehouse/logic";

type Unit = { id: string; serial: string; status: string; notes: string | null; warehouseId: string | null; location: string | null; packed: boolean };

/** Header actions of a unit: location, status, serial and notes. */
export function UnitActions({ unit, warehouses, canEdit, canWarehouse }: { unit: Unit; warehouses: { id: string; name: string }[]; canEdit: boolean; canWarehouse: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"mover" | "editar" | null>(null);
  const [wh, setWh] = useState(unit.warehouseId ?? "");
  const [loc, setLoc] = useState(unit.location ?? "");
  const [serial, setSerial] = useState(unit.serial);
  const [notes, setNotes] = useState(unit.notes ?? "");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(done);
      setDialog(null);
      router.refresh();
    });
  if (!canEdit && !canWarehouse) return null;
  const statuses = ["disponible", "reparacion", "limpieza", "perdida", "baja"].filter((s) => s !== unit.status);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Más acciones">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {canWarehouse && (
            <DropdownMenuItem onSelect={() => setDialog("mover")} disabled={unit.packed || unit.status === "en_obra"}>
              <MapPin /> Cambiar ubicación
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={() => setDialog("editar")}>
              <Pencil /> Número de serie y notas
            </DropdownMenuItem>
          )}
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Marcar como</DropdownMenuLabel>
              {statuses.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => run(() => setUnitStatus({ id: unit.id, status: s as "disponible" }), `Marcada como ${UNIT_STATUS_LABEL[s]?.toLowerCase()}`)}>
                  {UNIT_STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "mover"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Ubicación de {unit.serial}</DialogTitle>
            <DialogDescription>Si es una caja o un conjunto, todo lo que lleva dentro se mueve con ella.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Almacén" htmlFor="u-wh">
              <NativeSelect id="u-wh" value={wh} onChange={(e) => setWh(e.target.value)}>
                <option value="">Sin almacén</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Estantería / hueco" htmlFor="u-loc" hint="Por ejemplo A-03">
              <Input id="u-loc" value={loc} maxLength={40} onChange={(e) => setLoc(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => run(() => moveUnit({ unitId: unit.id, warehouseId: wh || null, location: loc.trim() || null }), "Ubicación guardada")}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "editar"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Número de serie y notas</DialogTitle>
            <DialogDescription>El código QR no cambia: las etiquetas ya pegadas siguen funcionando.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Número de serie" htmlFor="u-serial">
              <Input id="u-serial" value={serial} maxLength={60} onChange={(e) => setSerial(e.target.value)} />
            </Field>
            <Field label="Notas" htmlFor="u-notes">
              <Textarea id="u-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => run(() => saveUnitNotes({ unitId: unit.id, serial, notes: notes.trim() || null }), "Guardado")}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UnpackButton({ unitId, serial }: { unitId: string; serial: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Sacar ${serial} de la caja`}
      title="Sacar de la caja"
      onClick={() =>
        start(async () => {
          const r = await unpackUnit({ unitId });
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success(`${serial} fuera de la caja`);
          router.refresh();
        })
      }
    >
      <PackageOpen />
    </Button>
  );
}

/** Packing: add units by code/scan, and bulk contents (batteries, cables…) by quantity. */
export function ContainerPanel({ containerId, bulk, items, canEdit }: { containerId: string; bulk: { itemId: string; name: string; sku: string; quantity: number }[]; items: { id: string; name: string; sku: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [scan, setScan] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const pack = (c: string) =>
    start(async () => {
      const r = await packUnit({ containerId, code: c });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.data.name} ${r.data.serial} dentro`);
      if ("vibrate" in navigator) navigator.vibrate?.(40);
      setCode("");
      router.refresh();
    });
  const setBulk = (id: string, quantity: number) =>
    start(async () => {
      const r = await setUnitContent({ containerId, itemId: id, quantity });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setItemId("");
      setQty(1);
      router.refresh();
    });
  return (
    <div className="space-y-4">
      {bulk.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {bulk.map((b) => (
            <li key={b.itemId} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {b.name} <span className="font-mono text-[11px] text-muted-foreground">{b.sku}</span>
              </span>
              <span className="text-xs text-muted-foreground">a granel</span>
              {canEdit ? (
                <Input
                  type="number"
                  min={0}
                  defaultValue={b.quantity}
                  aria-label={`Cantidad de ${b.name}`}
                  className="h-8 w-20 text-right tabular"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== b.quantity) setBulk(b.itemId, v);
                  }}
                />
              ) : (
                <span className="tabular font-medium">× {formatNumber(b.quantity)}</span>
              )}
              {canEdit && (
                <Button variant="ghost" size="sm" aria-label={`Quitar ${b.name}`} disabled={pending} onClick={() => setBulk(b.itemId, 0)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="grid gap-4 md:grid-cols-2">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) pack(code.trim());
            }}
          >
            <p className="text-xs font-medium text-muted-foreground">Meter una unidad con número de serie</p>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código QR o número de serie" aria-label="Código de la unidad" />
              <Button type="submit" variant="outline" disabled={pending || !code.trim()}>
                <PackagePlus /> Meter
              </Button>
              <Button type="button" variant={scan ? "secondary" : "outline"} onClick={() => setScan((s) => !s)} aria-label={scan ? "Cerrar escáner" : "Escanear"}>
                {scan ? <X /> : <ScanLine />}
              </Button>
            </div>
            {scan && <QrScanner onScan={pack} paused={pending} />}
          </form>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (itemId && qty > 0) setBulk(itemId, (bulk.find((b) => b.itemId === itemId)?.quantity ?? 0) + qty);
            }}
          >
            <p className="text-xs font-medium text-muted-foreground">Añadir material sin número de serie</p>
            <div className="flex gap-2">
              <NativeSelect value={itemId} onChange={(e) => setItemId(e.target.value)} aria-label="Artículo" className="min-w-0 flex-1">
                <option value="">Elige un artículo…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </NativeSelect>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="Cantidad" className="w-20 text-right tabular" />
              <Button type="submit" variant="outline" disabled={pending || !itemId || qty <= 0}>
                Añadir
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
