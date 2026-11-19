"use client";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  type Row,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Bookmark, Check, Columns3, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { deleteView, saveView } from "@/server/actions/views";

export type FilterDef = { columnId: string; label: string; options: { value: string; label: string }[] };
export type SavedView = { id: string; name: string; config: ViewConfig };
export type ViewConfig = { search: string; sorting: SortingState; filters: ColumnFiltersState; visibility: VisibilityState };

/** Inline-editable cell: renders text, turns into an input on click and calls onSave. */
export function EditableCell({ value, onSave, type = "text", align = "left", disabled }: { value: string | number; onSave: (v: string) => Promise<boolean>; type?: "text" | "number"; align?: "left" | "right"; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  const [pending, start] = useTransition();
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(String(value));
  }
  if (disabled) return <span className={cn(align === "right" && "tabular block text-right")}>{value}</span>;
  if (!editing)
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className={cn("-mx-1.5 w-[calc(100%+12px)] rounded px-1.5 py-0.5 text-left hover:bg-accent", align === "right" && "tabular text-right")}
        aria-label="Editar"
      >
        {value === "" ? <span className="text-muted-foreground">—</span> : value}
      </button>
    );
  const commit = () =>
    start(async () => {
      if (v !== String(value)) {
        const ok = await onSave(v);
        if (!ok) setV(String(value));
      }
      setEditing(false);
    });
  return (
    <Input
      autoFocus
      type={type}
      value={v}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setV(String(value));
          setEditing(false);
        }
      }}
      className={cn("h-7", align === "right" && "text-right")}
    />
  );
}

export function DataTable<T>({
  data,
  columns,
  entity,
  views = [],
  filters = [],
  searchPlaceholder = "Buscar…",
  onRowClick,
  rowHref,
  empty,
  toolbar,
  initialVisibility,
  getRowId,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  entity: string;
  views?: SavedView[];
  filters?: FilterDef[];
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  empty?: React.ReactNode;
  toolbar?: React.ReactNode;
  initialVisibility?: VisibilityState;
  getRowId?: (row: T) => string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>(initialVisibility ?? {});
  const [activeView, setActiveView] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`rv.cols.${entity}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read of a per-viewer preference
      if (raw) setVisibility(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, [entity]);
  const updateVisibility = (v: VisibilityState) => {
    setVisibility(v);
    try {
      localStorage.setItem(`rv.cols.${entity}`, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  };

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: search, columnFilters, columnVisibility: visibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (u) => updateVisibility(typeof u === "function" ? u(visibility) : u),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: getRowId ? (r) => getRowId(r) : undefined,
    globalFilterFn: "includesString",
  });

  const applyView = (v: SavedView) => {
    setActiveView(v.id);
    setSearch(v.config.search);
    setSorting(v.config.sorting);
    setColumnFilters(v.config.filters);
    updateVisibility(v.config.visibility);
  };
  const currentConfig = useMemo<ViewConfig>(() => ({ search, sorting, filters: columnFilters, visibility }), [search, sorting, columnFilters, visibility]);

  const rows = table.getRowModel().rows;
  const click = (row: Row<T>) => {
    if (onRowClick) onRowClick(row.original);
    else if (rowHref) router.push(rowHref(row.original));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={searchPlaceholder} className="pl-8" aria-label="Buscar en la tabla" />
        </div>
        {filters.map((f) => {
          const val = (columnFilters.find((c) => c.id === f.columnId)?.value as string) ?? "";
          return (
            <NativeSelect
              key={f.columnId}
              aria-label={f.label}
              value={val}
              className="w-auto min-w-36"
              onChange={(e) => setColumnFilters((cf) => [...cf.filter((c) => c.id !== f.columnId), ...(e.target.value ? [{ id: f.columnId, value: e.target.value }] : [])])}
            >
              <option value="">{f.label}: todos</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {toolbar}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Bookmark /> {views.find((v) => v.id === activeView)?.name ?? "Vistas"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>Vistas guardadas</DropdownMenuLabel>
              {views.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Aún no hay vistas</p>}
              {views.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => applyView(v)}>
                  <span className="flex-1 truncate">{v.name}</span>
                  {activeView === v.id && <Check />}
                  <button
                    aria-label={`Eliminar vista ${v.name}`}
                    className="rounded p-0.5 hover:bg-background"
                    onClick={(e) => {
                      e.stopPropagation();
                      start(async () => {
                        await deleteView({ id: v.id });
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  const name = prompt("Nombre de la vista");
                  if (!name) return;
                  start(async () => {
                    const r = await saveView({ entity, name, config: currentConfig });
                    if (r.ok) {
                      toast.success("Vista guardada");
                      router.refresh();
                    } else toast.error(r.error);
                  });
                }}
              >
                <Bookmark /> Guardar vista actual
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Columnas">
                <Columns3 />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={(e) => e.preventDefault()} onClick={() => c.toggleVisibility()}>
                    <Checkbox checked={c.getIsVisible()} aria-hidden tabIndex={-1} />
                    {typeof c.columnDef.header === "string" ? c.columnDef.header : c.id}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-subtle">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const meta = h.column.columnDef.meta as { align?: "right" } | undefined;
                  return (
                    <th key={h.id} className={cn("h-10 whitespace-nowrap px-4 text-left align-middle text-[13px] font-normal text-muted-foreground", meta?.align === "right" && "text-right")} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button className={cn("inline-flex items-center gap-1 hover:text-foreground", meta?.align === "right" && "flex-row-reverse")} onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => click(row)} className={cn("border-b transition-colors last:border-0 hover:bg-subtle", (onRowClick || rowHref) && "cursor-pointer")}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { align?: "right" } | undefined;
                  return (
                    <td key={cell.id} className={cn("px-4 py-2.5 align-middle", meta?.align === "right" && "tabular text-right")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {data.length === 0 ? empty ?? "Sin registros" : "Ningún registro coincide con los filtros"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.length} de {data.length} registros
      </p>
    </div>
  );
}
