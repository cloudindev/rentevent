"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type SavedView } from "@/components/app/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactSheet } from "./contact-sheet";

type Row = { id: string; kind: string; name: string; taxId: string; email: string; phone: string; city: string; orders: number; archived: boolean };
export const KIND_LABEL: Record<string, string> = { cliente: "Cliente", proveedor: "Proveedor", localizacion: "Localización" };
const KIND_TONE = { cliente: "info", proveedor: "brand", localizacion: "neutral" } as const;

export function ContactsTable({ rows, views, canEdit, openNew }: { rows: Row[]; views: SavedView[]; canEdit: boolean; openNew: boolean }) {
  const [open, setOpen] = useState(openNew);
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Nombre", cell: ({ row }) => <Link href={`/app/contactos/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.name}</Link> },
      { accessorKey: "kind", header: "Tipo", filterFn: "equalsString", cell: ({ getValue }) => <StatusPill tone={KIND_TONE[getValue() as keyof typeof KIND_TONE] ?? "neutral"}>{KIND_LABEL[getValue() as string]}</StatusPill> },
      { accessorKey: "taxId", header: "NIF" },
      { accessorKey: "email", header: "Correo" },
      { accessorKey: "phone", header: "Teléfono" },
      { accessorKey: "city", header: "Población" },
      { accessorKey: "orders", header: "Pedidos", meta: { align: "right" } },
      { id: "estado", accessorFn: (r) => (r.archived ? "archivado" : "activo"), header: "Estado", filterFn: "equalsString", cell: ({ getValue }) => (getValue() === "archivado" ? <StatusPill>Archivado</StatusPill> : null) },
    ],
    [],
  );
  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        entity="contacts"
        views={views}
        getRowId={(r) => r.id}
        rowHref={(r) => `/app/contactos/${r.id}`}
        searchPlaceholder="Buscar por nombre, NIF o correo…"
        filters={[
          { columnId: "kind", label: "Tipo", options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })) },
          { columnId: "estado", label: "Estado", options: [{ value: "activo", label: "Activos" }, { value: "archivado", label: "Archivados" }] },
        ]}
        toolbar={canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus /> Nuevo contacto</Button>}
        empty="Aún no hay contactos."
      />
      {canEdit && <ContactSheet open={open} onOpenChange={setOpen} />}
    </>
  );
}
