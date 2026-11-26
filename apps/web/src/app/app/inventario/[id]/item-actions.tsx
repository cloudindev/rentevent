"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardCheck, Pencil, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { addUnits, recordCount } from "@/server/actions/inventory";
import { ItemSheet, type ItemFormValues } from "../item-sheet";

export function ItemActions({ item, canEdit, canCount }: { item: ItemFormValues & { id: string }; canEdit: boolean; canCount: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [count, setCount] = useState(false);
  const [units, setUnits] = useState(false);
  const [counted, setCounted] = useState(item.stockTotal);
  const [apply, setApply] = useState(true);
  const [n, setN] = useState(10);
  const [pending, start] = useTransition();
  return (
    <>
      {canCount && (
        <Button variant="outline" size="sm" onClick={() => setCount(true)}>
          <ClipboardCheck /> Recuento
        </Button>
      )}
      {canEdit && (
        <>
          <Button variant="outline" size="sm" onClick={() => setUnits(true)}>
            <QrCode /> Generar QR
          </Button>
          <Button size="sm" onClick={() => setEdit(true)}>
            <Pencil /> Editar
          </Button>
          <ItemSheet open={edit} onOpenChange={setEdit} initial={item} />
        </>
      )}
      <Dialog open={count} onOpenChange={setCount}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Inventario cíclico</DialogTitle>
            <DialogDescription>Stock en sistema: {item.stockTotal}</DialogDescription>
          </DialogHeader>
          <Field label="Unidades contadas" htmlFor="cnt">
            <Input id="cnt" type="number" min={0} value={counted} onChange={(e) => setCounted(Number(e.target.value))} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={apply} onCheckedChange={setApply} /> Ajustar el stock con la diferencia
          </label>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await recordCount({ itemId: item.id, counted, apply });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success(r.data.diff === 0 ? "Recuento correcto" : `Diferencia de ${r.data.diff}`);
                  setCount(false);
                  router.refresh();
                })
              }
            >
              Registrar recuento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={units} onOpenChange={setUnits}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Unidades con código QR</DialogTitle>
            <DialogDescription>Crea unidades seriadas con su propio QR para escanear en almacén.</DialogDescription>
          </DialogHeader>
          <Field label="Número de unidades" htmlFor="nu">
            <Input id="nu" type="number" min={1} max={500} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </Field>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await addUnits({ itemId: item.id, count: n });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  if (r.data.count < n) toast.warning(`Se han creado ${r.data.count} de ${n} unidades: algunos números de serie ya existían.`);
                  else toast.success(r.data.count === 1 ? "Unidad creada" : `${r.data.count} unidades creadas`);
                  setUnits(false);
                  router.refresh();
                })
              }
            >
              Crear unidades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
