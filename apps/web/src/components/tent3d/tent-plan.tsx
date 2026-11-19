"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Link2Off, RotateCw, TriangleAlert } from "lucide-react";
import type { Composition, StructureFamily } from "@rentevent/core";
import { snap } from "@rentevent/core/geometry/gutter";
import { cn } from "@/lib/utils";
import { BRAND, buildPlanModel, guttersSvg, scaleBarSvg, SIDE_COLORS, tentSvg } from "./plan-svg";

export type TentPlanProps = {
  composition: Composition;
  families: StructureFamily[];
  editable?: boolean;
  selectedTentId?: string | null;
  onChange?: (c: Composition) => void;
  onSelectTent?: (id: string) => void;
  className?: string;
};

type Drag = { kind: "move" | "rotate"; id: string; startX: number; startY: number; origX: number; origY: number; origRot: number };

export default function TentPlan({ composition, families, editable, selectedTentId, onChange, onSelectTent, className }: TentPlanProps) {
  const model = useMemo(() => buildPlanModel(composition, families), [composition, families]);
  const localRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [frozenViewBox, setFrozenViewBox] = useState<[number, number, number, number] | null>(null);
  const [siteImg, setSiteImg] = useState<{ url: string; w: number; h: number } | null>(null);
  const site = composition.site;
  const siteSize = site?.imageUrl && siteImg?.url === site.imageUrl ? siteImg : null;

  useEffect(() => {
    const url = site?.imageUrl;
    if (!url) return;
    const img = new Image();
    img.onload = () => setSiteImg({ url, w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [site?.imageUrl]);

  const viewBox = frozenViewBox ?? model.viewBox;

  const toPlan = (e: React.PointerEvent) => {
    const svg = localRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const update = (id: string, patch: Partial<{ x: number; y: number; rotation: number }>) => {
    onChange?.({
      ...composition,
      tents: composition.tents.map((t) => (t.id === id ? { ...t, placement: { ...t.placement, ...patch } } : t)),
    });
  };

  const onPointerDown = (e: React.PointerEvent, id: string, kind: Drag["kind"]) => {
    e.stopPropagation();
    onSelectTent?.(id);
    if (!editable) return;
    const t = composition.tents.find((x) => x.id === id)!;
    const p = toPlan(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setFrozenViewBox(model.viewBox);
    setDrag({ kind, id, startX: p.x, startY: p.y, origX: t.placement.x, origY: t.placement.y, origRot: t.placement.rotation });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toPlan(e);
    if (drag.kind === "move") {
      update(drag.id, { x: snap(drag.origX + p.x - drag.startX, 0.5), y: snap(drag.origY + p.y - drag.startY, 0.5) });
    } else {
      const ang = (Math.atan2(p.y - drag.origY, p.x - drag.origX) * 180) / Math.PI;
      update(drag.id, { rotation: ((snap(ang, 15) % 360) + 360) % 360 });
    }
  };
  const endDrag = () => {
    setDrag(null);
    setFrozenViewBox(null);
  };

  const join = (a: string, b: string, length: number) => onChange?.({ ...composition, gutters: [...composition.gutters, { a, b, length }] });
  const unjoin = (a: string, b: string) => onChange?.({ ...composition, gutters: composition.gutters.filter((g) => !(g.a === a && g.b === b)) });
  const label = (id: string) => model.tents.find((t) => t.id === id)?.label ?? id;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-white">
        <svg
          ref={localRef}
          viewBox={viewBox.join(" ")}
          className="h-full w-full touch-none select-none"
          role="img"
          aria-label="Plano acotado de la composición"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <rect x={viewBox[0]} y={viewBox[1]} width={viewBox[2]} height={viewBox[3]} fill="#ffffff" />
          {site?.imageUrl && site.metresPerPixel && siteSize && (
            <image
              href={site.imageUrl}
              x={site.offsetX}
              y={site.offsetY}
              width={siteSize.w * site.metresPerPixel}
              height={siteSize.h * site.metresPerPixel}
              transform={`rotate(${site.rotation} ${site.offsetX} ${site.offsetY})`}
              opacity={0.85}
              preserveAspectRatio="none"
            />
          )}
          {!site?.imageUrl && <GridPattern viewBox={viewBox} />}
          {model.tents.map((t) => {
            const selected = t.id === selectedTentId;
            return (
              <g key={t.id} transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}>
                <g dangerouslySetInnerHTML={{ __html: tentSvg(t, { selected }) }} />
                <rect
                  x={0}
                  y={-t.width / 2}
                  width={t.length}
                  height={t.width}
                  fill="transparent"
                  className={editable ? "cursor-move" : "cursor-pointer"}
                  onPointerDown={(e) => onPointerDown(e, t.id, "move")}
                >
                  <title>{`${t.label} · ${t.dims}`}</title>
                </rect>
                {editable && selected && (
                  <g transform={`translate(${t.length + 1.6} 0)`} className="cursor-grab" onPointerDown={(e) => onPointerDown(e, t.id, "rotate")}>
                    <line x1={-1.6} y1={0} x2={-0.5} y2={0} stroke={BRAND} strokeWidth={0.08} />
                    <circle r={0.55} fill="#ffffff" stroke={BRAND} strokeWidth={0.12} />
                    <title>Girar (pasos de 15°)</title>
                  </g>
                )}
              </g>
            );
          })}
          <g dangerouslySetInnerHTML={{ __html: guttersSvg(model) + scaleBarSvg({ ...model, viewBox }) }} />
        </svg>
        {editable && <p className="pointer-events-none absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">Arrastra para mover · <RotateCw className="inline size-3" /> para girar</p>}
      </div>

      <Legend />

      {(model.collisions.length > 0 || model.gutterCandidates.length > 0 || model.gutters.length > 0) && (
        <div className="space-y-1.5 text-[13px]">
          {model.collisions.map((c) => (
            <p key={`${c.a}-${c.b}`} className="flex items-center gap-2 rounded-lg bg-danger-bg px-2.5 py-1.5 text-danger">
              <TriangleAlert className="size-4" /> {label(c.a)} y {label(c.b)} se solapan {c.depth} m
            </p>
          ))}
          {model.gutterCandidates.map((g) => (
            <div key={`${g.a}-${g.b}`} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5">
              <span>
                {label(g.a)} y {label(g.b)} comparten {g.length} m
              </span>
              {editable && (
                <button className="inline-flex items-center gap-1 text-link hover:underline" onClick={() => join(g.a, g.b, g.length)}>
                  <Link2 className="size-3.5" /> Unir con canalón
                </button>
              )}
            </div>
          ))}
          {composition.gutters.map((g) => (
            <div key={`j-${g.a}-${g.b}`} className="flex items-center justify-between gap-2 rounded-lg bg-info-bg px-2.5 py-1.5 text-info">
              <span>
                Canalón {label(g.a)} – {label(g.b)} · {g.length} m
              </span>
              {editable && (
                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => unjoin(g.a, g.b)}>
                  <Link2Off className="size-3.5" /> Quitar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GridPattern({ viewBox }: { viewBox: [number, number, number, number] }) {
  const [x, y, w, h] = viewBox;
  const lines = [];
  const step = w > 120 ? 10 : 5;
  for (let gx = Math.ceil(x / step) * step; gx < x + w; gx += step) lines.push(<line key={`x${gx}`} x1={gx} y1={y} x2={gx} y2={y + h} />);
  for (let gy = Math.ceil(y / step) * step; gy < y + h; gy += step) lines.push(<line key={`y${gy}`} x1={x} y1={gy} x2={x + w} y2={gy} />);
  return (
    <g stroke="#efefed" strokeWidth={0.05}>
      {lines}
    </g>
  );
}

function Legend() {
  const items: [string, string, boolean][] = [
    ["Blanco", SIDE_COLORS.blanco, false],
    ["Transparente", SIDE_COLORS.transparente, false],
    ["Ventana", SIDE_COLORS.ventana, false],
    ["Puerta", SIDE_COLORS.puerta, false],
    ["Abierto", SIDE_COLORS.abierto, true],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map(([l, c, dashed]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-4 rounded-full" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${c} 0 3px, transparent 3px 6px)` : c }} />
          {l}
        </span>
      ))}
    </div>
  );
}
