"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { createBlankInvoiceAction, createInvoiceFromOrderAction, createSeriesAction } from "@/server/actions/finance";
import { useAction } from "./use-action";

type OrderOpt = { id: string; number: string; title: string; status: string; clientName: string | null };
type ClientOpt = { id: string; name: string };

export function NewInvoiceDialog({ orders, clients, defaultOrderId }: { orders: OrderOpt[]; clients: ClientOpt[]; defaultOrderId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultOrderId));
  const [orderId, setOrderId] = useState(defaultOrderId ?? orders[0]?.id ?? "");
  const [kind, setKind] = useState<"normal" | "anticipo">("normal");
  const [percent, setPercent] = useState(30);
  const [clientId, setClientId] = useState("");
  const { pending, run } = useAction();
  const go = (d: { id: string }) => {
    setOpen(false);
    router.push(`/app/ventas/${d.id}`);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nueva factura
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva factura</DialogTitle>
          <DialogDescription>Se crea como borrador: podrás revisarla antes de emitirla.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={orders.length ? "pedido" : "blanco"}>
          <TabsList>
            <TabsTrigger value="pedido">Desde un pedido</TabsTrigger>
            <TabsTrigger value="blanco">En blanco</TabsTrigger>
          </TabsList>
          <TabsContent value="pedido" className="space-y-4 pt-4">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pedidos en opción, confirmados o en curso.</p>
            ) : (
              <>
                <Field label="Pedido" htmlFor="ni-order">
                  <NativeSelect id="ni-order" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.number} · {o.title}
                        {o.clientName ? ` · ${o.clientName}` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo" htmlFor="ni-kind">
                    <NativeSelect id="ni-kind" value={kind} onChange={(e) => setKind(e.target.value as "normal" | "anticipo")}>
                      <option value="normal">Factura final</option>
                      <option value="anticipo">Anticipo</option>
                    </NativeSelect>
                  </Field>
                  {kind === "anticipo" && (
                    <Field label="Porcentaje" htmlFor="ni-pct">
                      <Input id="ni-pct" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
                    </Field>
                  )}
                </div>
                {kind === "normal" && <p className="text-xs text-muted-foreground">Los anticipos ya emitidos del pedido se descuentan automáticamente.</p>}
                <DialogFooter>
                  <Button disabled={pending || !orderId} onClick={() => run(() => createInvoiceFromOrderAction({ orderId, kind, percent }), { onOk: go })}>
                    Crear borrador
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>
          <TabsContent value="blanco" className="space-y-4 pt-4">
            <Field label="Cliente" htmlFor="ni-client">
              <NativeSelect id="ni-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Elegir después</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <DialogFooter>
              <Button disabled={pending} onClick={() => run(() => createBlankInvoiceAction({ clientId: clientId || null }), { onOk: go })}>
                Crear borrador
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function NewSeriesDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", name: "", kind: "normal" as "normal" | "rectificativa" | "anticipo", year: new Date().getFullYear() });
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus /> Nueva serie
        </Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Nueva serie de facturación</DialogTitle>
          <DialogDescription>La numeración empieza en 1 y es correlativa por año.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código" htmlFor="s-code">
            <Input id="s-code" value={f.code} maxLength={6} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Año" htmlFor="s-year">
            <Input id="s-year" type="number" value={f.year} onChange={(e) => setF({ ...f, year: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Nombre" htmlFor="s-name">
          <Input id="s-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Tipo" htmlFor="s-kind">
          <NativeSelect id="s-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as typeof f.kind })}>
            <option value="normal">Facturas</option>
            <option value="rectificativa">Rectificativas</option>
            <option value="anticipo">Anticipos</option>
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button disabled={pending || !f.code || f.name.length < 2} onClick={() => run(() => createSeriesAction(f), { success: "Serie creada", onOk: () => setOpen(false) })}>
            Crear serie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
