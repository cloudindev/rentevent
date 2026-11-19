import { Boxes, Package } from "lucide-react";
import { asc, items, kitItems, kits } from "@rentevent/db";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty";
import { can } from "@/lib/permissions";
import { formatEUR } from "@/lib/utils";
import { tenantDb } from "@/server/context";
import { InventoryTabs } from "../tabs";
import { KitEditor } from "./kit-editor";

export const metadata = { title: "Kits" };

export default async function KitsPage() {
  const d = await tenantDb(async (tx, ctx) => ({
    kits: await tx.select().from(kits).orderBy(asc(kits.name)),
    lines: await tx.select().from(kitItems),
    items: await tx.select({ id: items.id, name: items.name, sku: items.sku }).from(items).orderBy(asc(items.name)),
    role: ctx.role,
  }));
  const name = new Map(d.items.map((i) => [i.id, i.name]));
  const canEdit = can(d.role, "inventario");
  return (
    <>
      <PageHeader icon={Boxes} title="Inventario">
        {canEdit && <KitEditor items={d.items} />}
      </PageHeader>
      <InventoryTabs />
      <PageBody>
        {d.kits.length === 0 ? (
          <EmptyState icon={Package} title="Sin kits" description="Agrupa artículos que se alquilan juntos (por ejemplo, un pack de iluminación) para añadirlos al pedido de una vez." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {d.kits.map((k) => {
              const lines = d.lines.filter((l) => l.kitId === k.id);
              return (
                <article key={k.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{k.name}</h3>
                      <p className="font-mono text-xs text-muted-foreground">{k.sku}</p>
                    </div>
                    <span className="tabular text-sm font-medium">{formatEUR(Number(k.price))}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {lines.map((l) => (
                      <li key={l.id} className="flex justify-between">
                        <span>{name.get(l.itemId)}</span>
                        <span className="tabular text-muted-foreground">× {Number(l.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <div className="mt-3">
                      <KitEditor items={d.items} kit={{ id: k.id, sku: k.sku, name: k.name, price: Number(k.price), description: k.description, lines: lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) })) }} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
