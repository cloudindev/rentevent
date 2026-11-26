/** Project phases derived from an order's dates (carga → retorno). Pure logic, shared by the order actions and tests. */

export type DerivedPhaseKind = "carga" | "transporte" | "montaje" | "evento" | "desmontaje" | "retorno";
export type OrderDates = { load: Date; eventStart: Date; eventEnd: Date; ret: Date };

const H = 3_600_000;

export function phaseTimes({ load, eventStart, eventEnd, ret }: OrderDates): [DerivedPhaseKind, Date, Date][] {
  const t = (d: Date, h: number) => new Date(d.getTime() + h * H);
  const montajeEnd = new Date(Math.max(t(load, 6).getTime(), eventStart.getTime() - 2 * H));
  return [
    ["carga", load, t(load, 2)],
    ["transporte", t(load, 2), t(load, 4)],
    ["montaje", t(load, 4), montajeEnd > t(load, 4) ? montajeEnd : t(load, 10)],
    ["evento", eventStart, eventEnd],
    ["desmontaje", t(eventEnd, 2), new Date(Math.max(t(eventEnd, 6).getTime(), ret.getTime() - 3 * H))],
    ["retorno", new Date(ret.getTime() - 3 * H), ret],
  ];
}

/**
 * When one order's dates change, moves only the project phases that were generated from that
 * order's previous dates and never edited by hand (same kind and exactly the same start and end).
 * Manual edits and phases that come from other orders are left alone.
 */
export function rederivePhases(phases: { id: string; kind: string; startsAt: Date; endsAt: Date }[], before: OrderDates, after: OrderDates): { id: string; startsAt: Date; endsAt: Date }[] {
  const next = new Map(phaseTimes(after).map(([k, a, b]) => [k, { a, b }]));
  const out: { id: string; startsAt: Date; endsAt: Date }[] = [];
  const used = new Set<string>();
  for (const [kind, a, b] of phaseTimes(before)) {
    const match = phases.find((p) => !used.has(p.id) && p.kind === kind && p.startsAt.getTime() === a.getTime() && p.endsAt.getTime() === b.getTime());
    if (!match) continue;
    used.add(match.id);
    const n = next.get(kind)!;
    if (n.a.getTime() !== a.getTime() || n.b.getTime() !== b.getTime()) out.push({ id: match.id, startsAt: n.a, endsAt: n.b });
  }
  return out;
}
