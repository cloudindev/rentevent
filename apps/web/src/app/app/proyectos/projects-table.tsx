"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays } from "@rentevent/core";
import { DataTable, type SavedView } from "@/components/app/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ORDER_STATUS } from "@/components/app/order-status";
import { formatEUR, formatRange } from "@/lib/utils";
import { createProject } from "@/server/actions/projects";
import { fromLocalInput } from "../pedidos/[id]/header-sheet";

type Row = { id: string; number: string; name: string; status: string; startsAt: string | null; endsAt: string | null; client: string; orders: number; value: number };
type Opt = { id: string; name: string };

export function ProjectsTable({ rows, views, clients, venues, canCreate, openNew }: { rows: Row[]; views: SavedView[]; clients: Opt[]; venues: Opt[]; canCreate: boolean; openNew: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openNew);
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({ name: "", clientId: "", venueId: "", startsAt: `${addDays(today, 14)}T08:00`, endsAt: `${addDays(today, 17)}T18:00`, description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "number", header: "Nº", cell: ({ getValue }) => <span className="tabular text-muted-foreground">{getValue() as string}</span> },
      { accessorKey: "name", header: "Proyecto", cell: ({ row }) => <Link href={`/app/proyectos/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.name}</Link> },
      { accessorKey: "client", header: "Cliente" },
      { accessorKey: "startsAt", header: "Fechas", cell: ({ row }) => <span className="whitespace-nowrap">{formatRange(row.original.startsAt, row.original.endsAt)}</span> },
      { accessorKey: "status", header: "Estado", filterFn: "equalsString", cell: ({ getValue }) => { const s = ORDER_STATUS[getValue() as string]; return <StatusPill tone={s?.tone ?? "neutral"}>{s?.label ?? (getValue() as string)}</StatusPill>; } },
      { accessorKey: "orders", header: "Pedidos", meta: { align: "right" } },
      { accessorKey: "value", header: "Valor", meta: { align: "right" }, cell: ({ getValue }) => formatEUR(getValue() as number) },
    ],
    [],
  );
  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        entity="projects"
        views={views}
        getRowId={(r) => r.id}
        rowHref={(r) => `/app/proyectos/${r.id}`}
        searchPlaceholder="Buscar proyecto o cliente…"
        filters={[{ columnId: "status", label: "Estado", options: Object.entries(ORDER_STATUS).filter(([k]) => k !== "borrador").map(([value, s]) => ({ value, label: s.label })) }]}
        toolbar={canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus /> Nuevo proyecto</Button>}
        empty="Aún no hay proyectos."
      />
      <Sheet open={open} onOpenChange={setOpen} title="Nuevo proyecto" description="Un proyecto agrupa los pedidos de un evento con sus fases, personal y transporte.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createProject({ name: v.name, clientId: v.clientId || null, venueId: v.venueId || null, startsAt: fromLocalInput(v.startsAt), endsAt: fromLocalInput(v.endsAt), description: v.description || null });
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                toast.error(r.error);
                return;
              }
              router.push(`/app/proyectos/${r.data.id}`);
            });
          }}
        >
          <Field label="Nombre" htmlFor="np-name" error={errors.name}><Input id="np-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Cliente" htmlFor="np-client"><NativeSelect id="np-client" value={v.clientId} onChange={(e) => setV({ ...v, clientId: e.target.value })}><option value="">Sin cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
          <Field label="Lugar" htmlFor="np-venue"><NativeSelect id="np-venue" value={v.venueId} onChange={(e) => setV({ ...v, venueId: e.target.value })}><option value="">Sin lugar</option>{venues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio (carga)" htmlFor="np-s"><Input id="np-s" type="datetime-local" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} /></Field>
            <Field label="Fin (retorno)" htmlFor="np-e" error={errors.endsAt}><Input id="np-e" type="datetime-local" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} /></Field>
          </div>
          <Field label="Descripción" htmlFor="np-d"><Textarea id="np-d" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          <Button disabled={pending}>Crear proyecto</Button>
        </form>
      </Sheet>
    </>
  );
}
