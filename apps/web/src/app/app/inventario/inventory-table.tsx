"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, EditableCell, type SavedView } from "@/components/app/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEUR, formatNumber } from "@/lib/utils";
import { patchItem } from "@/server/actions/inventory";
import { ItemSheet } from "./item-sheet";

export type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  kind: string;
  unit: string;
  role: string;
  stockTotal: number;
  stockRepair: number;
  availableToday: number;
  location: string;
  price: number;
  priceMode: string;
  weightKg: number;
  active: boolean;
  pending: boolean;
};

const KIND_LABEL: Record<string, string> = { granel: "A granel", seriado: "Seriado", consumible: "Consumible", servicio: "Servicio" };

export function InventoryTable({ rows, views, canEdit, openNew }: { rows: InventoryRow[]; views: SavedView[]; canEdit: boolean; openNew: boolean }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(openNew);
  const patch = (id: string, field: "stockTotal" | "price" | "location") => async (value: string) => {
    const r = await patchItem({ id, field, value });
    if (!r.ok) toast.error(r.error);
    else router.refresh();
    return r.ok;
  };
  const columns = useMemo<ColumnDef<InventoryRow, unknown>[]>(
    () => [
      { accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-mono text-[12px] text-muted-foreground">{row.original.sku}</span> },
      {
        accessorKey: "name",
        header: "Artículo",
        cell: ({ row }) => (
          <Link href={`/app/inventario/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "category", header: "Categoría", filterFn: "equalsString" },
      { accessorKey: "kind", header: "Tipo", filterFn: "equalsString", cell: ({ getValue }) => KIND_LABEL[getValue() as string] ?? getValue() },
      { accessorKey: "stockTotal", header: "Stock", meta: { align: "right" }, cell: ({ row }) => <EditableCell value={row.original.stockTotal} type="number" align="right" disabled={!canEdit} onSave={patch(row.original.id, "stockTotal")} /> },
      { accessorKey: "stockRepair", header: "En reparación", meta: { align: "right" }, cell: ({ getValue }) => ((getValue() as number) > 0 ? <span className="text-warning">{formatNumber(getValue() as number)}</span> : "0") },
      {
        accessorKey: "availableToday",
        header: "Libres hoy",
        meta: { align: "right" },
        cell: ({ row }) => {
          const a = row.original.availableToday;
          const usable = row.original.stockTotal - row.original.stockRepair;
          return <StatusPill tone={a <= 0 ? "danger" : a < usable * 0.2 ? "warning" : "success"}>{formatNumber(a)}</StatusPill>;
        },
      },
      { accessorKey: "location", header: "Ubicación", cell: ({ row }) => <EditableCell value={row.original.location} disabled={!canEdit} onSave={patch(row.original.id, "location")} /> },
      {
        accessorKey: "price",
        header: "Tarifa",
        meta: { align: "right" },
        cell: ({ row }) => (row.original.priceMode === "incluido" ? <span className="text-muted-foreground">Incluido</span> : <EditableCell value={row.original.price} type="number" align="right" disabled={!canEdit} onSave={patch(row.original.id, "price")} />),
      },
      { accessorKey: "weightKg", header: "Peso kg", meta: { align: "right" }, cell: ({ getValue }) => formatNumber(getValue() as number) },
      { id: "estado", header: "Estado", accessorFn: (r) => (r.active ? (r.pending ? "pendiente" : "activo") : "inactivo"), cell: ({ getValue }) => (getValue() === "pendiente" ? <StatusPill tone="warning">Datos de ejemplo</StatusPill> : getValue() === "inactivo" ? <StatusPill>Inactivo</StatusPill> : <StatusPill tone="success">Activo</StatusPill>) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit],
  );
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        entity="items"
        views={views}
        getRowId={(r) => r.id}
        rowHref={(r) => `/app/inventario/${r.id}`}
        searchPlaceholder="Buscar por nombre o SKU…"
        initialVisibility={{ weightKg: false }}
        filters={[
          { columnId: "category", label: "Categoría", options: categories.map((c) => ({ value: c, label: c })) },
          { columnId: "kind", label: "Tipo", options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })) },
        ]}
        toolbar={
          canEdit && (
            <Button size="sm" onClick={() => setSheet(true)}>
              <Plus /> Nuevo artículo
            </Button>
          )
        }
        empty="Aún no hay artículos. Créalos o impórtalos desde Configuración › Importar."
      />
      {canEdit && <ItemSheet open={sheet} onOpenChange={setSheet} />}
      <p className="text-xs text-muted-foreground">Precios en {formatEUR(0).replace(/0,00/, "")}; los artículos “incluido” forman parte del precio de la carpa.</p>
    </>
  );
}
