"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { deleteKit, saveKit } from "@/server/actions/inventory";

type Kit = { id: string | null; sku: string; name: string; price: number; description: string | null; lines: { itemId: string; quantity: number }[] };

export function KitEditor({ items, kit }: { items: { id: string; name: string; sku: string }[]; kit?: Kit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [k, setK] = useState<Kit>(kit ?? { id: null, sku: "", name: "", price: 0, description: null, lines: [] });
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" variant={kit ? "outline" : "default"} onClick={() => setOpen(true)}>
        {kit ? "Editar" : (
          <>
            <Plus /> Nuevo kit
          </>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={kit ? "Editar kit" : "Nuevo kit"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" htmlFor="k-sku">
              <Input id="k-sku" value={k.sku} onChange={(e) => setK({ ...k, sku: e.target.value })} />
            </Field>
            <Field label="Precio" htmlFor="k-price">
              <Input id="k-price" type="number" step="0.01" value={k.price} onChange={(e) => setK({ ...k, price: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Nombre" htmlFor="k-name">
            <Input id="k-name" value={k.name} onChange={(e) => setK({ ...k, name: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Artículos</p>
            {k.lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <NativeSelect aria-label="Artículo" value={l.itemId} onChange={(e) => setK({ ...k, lines: k.lines.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)) })}>
                  <option value="">Elige…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </NativeSelect>
                <Input aria-label="Cantidad" type="number" min={1} className="w-24" value={l.quantity} onChange={(e) => setK({ ...k, lines: k.lines.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)) })} />
                <Button variant="ghost" size="icon" aria-label="Quitar" onClick={() => setK({ ...k, lines: k.lines.filter((_, j) => j !== i) })}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setK({ ...k, lines: [...k.lines, { itemId: "", quantity: 1 }] })}>
              <Plus /> Añadir artículo
            </Button>
          </div>
          <div className="flex justify-between">
            {kit?.id ? (
              <Button
                variant="ghost"
                className="text-danger"
                onClick={() =>
                  start(async () => {
                    await deleteKit({ id: kit.id! });
                    setOpen(false);
                    router.refresh();
                  })
                }
              >
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveKit({ ...k, lines: k.lines.filter((l) => l.itemId) });
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              Guardar kit
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
