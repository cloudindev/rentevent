"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type SavedView } from "@/components/app/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS } from "@/components/app/order-status";
import { formatEUR, formatRange } from "@/lib/utils";

type Row = { id: string; number: string; title: string; status: string; periodStart: string; periodEnd: string; client: string; project: string; projectId: string | null; total: number | null };

export function OrdersTable({ rows, views, canCreate }: { rows: Row[]; views: SavedView[]; canCreate: boolean }) {
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "number", header: "Nº", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue() as string}</span> },
      { accessorKey: "title", header: "Pedido", cell: ({ row }) => <Link href={`/app/pedidos/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.title}</Link> },
      { accessorKey: "client", header: "Cliente" },
      { accessorKey: "periodStart", header: "Carga – retorno", cell: ({ row }) => <span className="whitespace-nowrap">{formatRange(row.original.periodStart, row.original.periodEnd)}</span> },
      { accessorKey: "status", header: "Estado", filterFn: "equalsString", cell: ({ getValue }) => { const s = ORDER_STATUS[getValue() as string]; return <StatusPill tone={s?.tone ?? "neutral"}>{s?.label ?? (getValue() as string)}</StatusPill>; } },
      { accessorKey: "project", header: "Proyecto" },
      { accessorKey: "total", header: "Último presupuesto", meta: { align: "right" }, cell: ({ getValue }) => (getValue() != null ? formatEUR(getValue() as number) : <span className="text-muted-foreground">—</span>) },
    ],
    [],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      entity="orders"
      views={views}
      getRowId={(r) => r.id}
      rowHref={(r) => `/app/pedidos/${r.id}`}
      searchPlaceholder="Buscar por número, título o cliente…"
      filters={[{ columnId: "status", label: "Estado", options: Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label })) }]}
      toolbar={canCreate && <Button size="sm" asChild><Link href="/app/pedidos/nuevo"><Plus /> Nuevo pedido</Link></Button>}
      empty="Aún no hay pedidos."
    />
  );
}
