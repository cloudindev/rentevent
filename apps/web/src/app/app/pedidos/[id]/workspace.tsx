"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import { checkLines, daysBetween, type LineCheck } from "@rentevent/core";
import type { OrderWorkspaceData } from "@/server/orders";
import { orderTotals, type WorkLine } from "@/lib/order-model";
import { DateChip, PageHeader } from "@/components/app/page-header";
import { formatRange } from "@/lib/utils";
import { saveOrderLines } from "@/server/actions/orders";
import { AddSearch } from "./add-search";
import { LinesTable, type SelectedRow } from "./lines-table";
import { TimelineCard } from "./timeline-card";
import { TentConfigurator } from "./tent-configurator";
import { TotalsPanel } from "./totals-panel";
import { StatusMenu } from "./status-menu";
import { HeaderSheet } from "./header-sheet";
import { QuotePanel } from "./quote-panel";
import type { TentViewerApi } from "@/components/tent3d";

export type Perms = { edit: boolean; confirm: boolean; margin: boolean; finance: boolean };

export function OrderWorkspace({ data, perms }: { data: OrderWorkspaceData; perms: Perms }) {
  const router = useRouter();
  const { order, catalogue } = data;
  const [lines, setLines] = useState<WorkLine[]>(data.lines);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [selected, setSelected] = useState<SelectedRow | null>(null);
  const [headerOpen, setHeaderOpen] = useState(false);
  const viewerApi = useRef<TentViewerApi | null>(null);
  const savedLines = useRef(JSON.stringify(data.lines));
  const ownSavedAt = useRef<string | null>(null);
  const latest = useRef(lines);
  useEffect(() => {
    latest.current = lines;
  }, [lines]);
  const editable = perms.edit && !["devuelto", "cancelado"].includes(order.status);

  // server data refreshed (router.refresh) → adopt it if we have no local edits
  useEffect(() => {
    const incoming = JSON.stringify(data.lines);
    if (data.order.updatedAt === ownSavedAt.current) {
      // our own save coming back: keep local keys and selection
      savedLines.current = incoming;
      return;
    }
    if (!dirty && incoming !== savedLines.current) {
      savedLines.current = incoming;
      setLines(data.lines);
    }
  }, [data.lines, data.order.updatedAt, dirty]);

  const days = order.eventStart && order.eventEnd ? daysBetween(new Date(order.eventStart).getTime(), new Date(order.eventEnd).getTime()) : 1;
  const computed = useMemo(
    () => orderTotals(lines, catalogue, { days, holiday: order.holiday, settings: data.pricing, globalDiscountPct: order.discountPct }),
    [lines, catalogue, days, order.holiday, data.pricing, order.discountPct],
  );

  // live availability, computed in the browser with the same engine as the server
  const stocks = useMemo(() => new Map(data.availability.stocks.map((s) => [s.itemId, s])), [data.availability.stocks]);
  const checks = useMemo(() => {
    const res = checkLines(
      computed.requirements,
      stocks,
      data.availability.reservations,
      data.availability.subrentals,
      { start: new Date(order.periodStart).getTime(), end: new Date(order.periodEnd).getTime() },
      { marginMinutes: data.marginMinutes, excludeProjectId: order.id },
    );
    return new Map<string, LineCheck>(res.map((c) => [c.itemId, c]));
  }, [computed.requirements, stocks, data.availability, order.periodStart, order.periodEnd, order.id, data.marginMinutes]);
  const freeOf = useCallback((itemId: string) => {
    const c = checks.get(itemId);
    return c ? c.available : null;
  }, [checks]);

  const update = useCallback((next: WorkLine[]) => {
    setLines(next);
    setDirty(true);
  }, []);

  // autosave (debounced)
  useEffect(() => {
    if (!dirty || !editable) return;
    const t = setTimeout(() => {
      const snapshot = lines;
      startSave(async () => {
        const r = await saveOrderLines({ orderId: order.id, lines: snapshot });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        ownSavedAt.current = r.data.savedAt;
        const ids = r.data.configIds;
        const editedMeanwhile = JSON.stringify(latest.current) !== JSON.stringify(snapshot);
        setLines((cur) => cur.map((l) => (l.kind === "carpa" && !l.tentConfigId && ids[l.key] ? { ...l, tentConfigId: ids[l.key]! } : l)));
        setDirty(editedMeanwhile);
        router.refresh();
      });
    }, 900);
    return () => clearTimeout(t);
  }, [lines, dirty, editable, order.id, router]);

  const shortTotal = [...checks.values()].reduce((s, c) => s + c.shortage, 0);
  const selectedTent = selected?.kind === "carpa" ? lines.find((l) => l.key === selected.lineKey && l.kind === "carpa") : null;

  return (
    <>
      <PageHeader icon={ListChecks} title={`Pedido ${order.number} · ${order.title}`} back={{ href: "/app/pedidos", label: "Pedidos" }}>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? "Guardando…" : dirty ? "Cambios sin guardar" : "Guardado"}
        </span>
        {editable ? (
          <button onClick={() => setHeaderOpen(true)} className="rounded-lg hover:bg-accent" aria-label="Editar fechas y datos del pedido">
            <DateChip>{formatRange(order.periodStart, order.periodEnd)}</DateChip>
          </button>
        ) : (
          <DateChip>{formatRange(order.periodStart, order.periodEnd)}</DateChip>
        )}
        <StatusMenu orderId={order.id} status={order.status} canConfirm={perms.confirm} canEdit={perms.edit} optionExpiresAt={order.optionExpiresAt} dirty={dirty || saving} />
      </PageHeader>
      <div className="grid gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {editable && <AddSearch catalogue={catalogue} lines={lines} onChange={update} freeOf={freeOf} order={order} computed={computed} pricing={data.pricing} onAddedTent={(key) => setSelected({ kind: "carpa", lineKey: key, itemId: null })} />}
          <LinesTable
            lines={lines}
            catalogue={catalogue}
            computed={computed}
            checks={checks}
            selected={selected}
            onSelect={setSelected}
            onChange={editable ? update : undefined}
          />
          {selected?.itemId && <TimelineCard orderId={order.id} itemId={selected.itemId} quantity={computed.requirements.find((r) => r.itemId === selected.itemId)?.quantity ?? 0} catalogue={catalogue} version={JSON.stringify(computed.requirements)} saved={!dirty && !saving} />}
          {selectedTent && selectedTent.kind === "carpa" && (
            <TentConfigurator
              key={selectedTent.key}
              line={selectedTent}
              catalogue={catalogue}
              checks={checks}
              stocks={stocks}
              availability={data.availability}
              order={order}
              marginMinutes={data.marginMinutes}
              editable={editable}
              onChange={(l) => update(lines.map((x) => (x.key === l.key ? l : x)))}
              onReplace={(newLines) => update(newLines)}
              allLines={lines}
              apiRef={viewerApi}
            />
          )}
        </div>
        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <TotalsPanel totals={computed.totals} rows={computed.rows} showMargin={perms.margin} shortTotal={shortTotal} order={order} days={days} />
          <QuotePanel orderId={order.id} quotes={data.quotes} clientEmail={order.clientEmail} canEdit={perms.edit} canInvoice={perms.finance} dirty={dirty || saving} viewerApi={viewerApi} hasTent={lines.some((l) => l.kind === "carpa")} />
          <section className="rounded-xl border bg-card p-4 text-sm">
            <h3 className="mb-2 font-semibold">Evento</h3>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1.5">
              <dt className="text-muted-foreground">Proyecto</dt>
              <dd><a className="hover:underline" href={`/app/proyectos/${order.projectId}`}>{order.projectName}</a></dd>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd>{order.clientName ?? "—"}</dd>
              <dt className="text-muted-foreground" title="Es el lugar del proyecto: lo comparten todos sus pedidos">Lugar del proyecto</dt>
              <dd>{order.venueName ?? "—"}{!order.anchoringAllowed && <span className="block text-xs text-warning">No se puede anclar: usar pesos</span>}</dd>
              <dt className="text-muted-foreground">Evento</dt>
              <dd>{formatRange(order.eventStart, order.eventEnd)}</dd>
              <dt className="text-muted-foreground" title="Es la distancia del proyecto: la comparten todos sus pedidos">Distancia</dt>
              <dd>{order.distanceKm != null ? `${Math.round(order.distanceKm)} km` : "—"}</dd>
            </dl>
            {editable && <button className="mt-3 text-link hover:underline" onClick={() => setHeaderOpen(true)}>Editar datos y fechas</button>}
            {perms.edit && !editable && <p className="mt-3 text-xs text-muted-foreground">Pedido cerrado: reábrelo desde el estado para editar sus datos.</p>}
          </section>
        </aside>
      </div>
      {editable && <HeaderSheet open={headerOpen} onOpenChange={setHeaderOpen} order={order} clients={data.clients} venues={data.venues} />}
    </>
  );
}
