"use client";
import { useMemo, useRef, useState } from "react";
import { Box, Download, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import {
  ANCHORING_LABELS,
  BOM_GROUP_LABELS,
  computeCompositionBom,
  defaultConfiguration,
  gutterFromItems,
  LAYOUT_LABELS,
  type BomItem,
  type BomRule,
  type Composition,
  type SeatingLayout,
  type StructureFamily,
  type VehicleType,
} from "@rentevent/core";
import { TentPlan, TentViewer, type TentViewerApi } from "@/components/tent3d";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { formatNumber } from "@/lib/utils";

type Props = { families: StructureFamily[]; items: BomItem[]; rules: BomRule[]; vehicles: VehicleType[] };

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VisorClient({ families, items, rules, vehicles }: Props) {
  const first = families.find((f) => f.width === 10 && f.roofShape !== "jaima") ?? families.find((f) => f.roofShape !== "jaima") ?? families[0]!;
  const [composition, setComposition] = useState<Composition>(() => ({
    version: 1,
    tents: [{ id: "t1", label: first.name, config: defaultConfiguration(first, 4), placement: { x: 0, y: 0, rotation: 0 } }],
    gutters: [],
    site: null,
  }));
  const [selected, setSelected] = useState<string>("t1");
  const api = useRef<TentViewerApi>(null);
  const famById = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const gutter = useMemo(() => gutterFromItems(items), [items]);
  const bom = useMemo(() => computeCompositionBom({ composition, families, rules, items, vehicles, gutter }), [composition, families, rules, items, vehicles, gutter]);

  const tent = composition.tents.find((t) => t.id === selected) ?? composition.tents[0]!;
  const fam = famById.get(tent.config.familyId)!;

  const updateTent = (fn: (t: Composition["tents"][number]) => Composition["tents"][number]) =>
    setComposition((c) => ({ ...c, tents: c.tents.map((t) => (t.id === tent.id ? fn(t) : t)) }));

  const addTent = () => {
    const id = `t${Date.now().toString(36)}`;
    const maxY = Math.max(...composition.tents.map((t) => t.placement.y + (famById.get(t.config.familyId)?.width ?? 10) / 2));
    const f = famById.get(tent.config.familyId)!;
    setComposition((c) => ({ ...c, tents: [...c.tents, { id, label: `${f.name} ${c.tents.length + 1}`, config: defaultConfiguration(f, 3), placement: { x: 0, y: maxY + f.width / 2, rotation: 0 } }] }));
    setSelected(id);
  };

  return (
    <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            aria-label="Familia"
            className="w-auto"
            value={tent.config.familyId}
            onChange={(e) => {
              const f = famById.get(e.target.value)!;
              updateTent((t) => ({ ...t, label: f.name, config: { ...defaultConfiguration(f, Math.min(f.maxModules, t.config.modules)), anchoring: t.config.anchoring } }));
            }}
          >
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Fijación" className="w-auto" value={tent.config.anchoring} onChange={(e) => updateTent((t) => ({ ...t, config: { ...t.config, anchoring: e.target.value as "anclaje" | "pesos" } }))}>
            {Object.entries(ANCHORING_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Distribución interior"
            className="w-auto"
            value={tent.config.interior.layout}
            onChange={(e) => updateTent((t) => ({ ...t, config: { ...t.config, interior: { ...t.config.interior, layout: e.target.value as SeatingLayout } } }))}
          >
            {Object.entries(LAYOUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={tent.config.floors.tarima.enabled}
              onChange={(e) => updateTent((t) => ({ ...t, config: { ...t.config, floors: { ...t.config.floors, tarima: { ...t.config.floors.tarima, enabled: e.target.checked } } } }))}
            />
            Tarima
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={tent.config.interior.stage.enabled}
              onChange={(e) => updateTent((t) => ({ ...t, config: { ...t.config, interior: { ...t.config.interior, stage: { ...t.config.interior.stage, enabled: e.target.checked } } } }))}
            />
            Escenario
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={addTent}>
              <Plus /> Añadir carpa
            </Button>
            {composition.tents.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setComposition((c) => ({ ...c, tents: c.tents.filter((t) => t.id !== tent.id), gutters: c.gutters.filter((g) => g.a !== tent.id && g.b !== tent.id) }));
                  setSelected(composition.tents.find((t) => t.id !== tent.id)!.id);
                }}
              >
                <Trash2 /> Quitar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={async () => api.current && download(await api.current.toPNG(), "carpa.png")}>
              <ImageIcon /> PNG
            </Button>
            <Button variant="outline" size="sm" onClick={async () => api.current && download(await api.current.toGLTF(), "carpa.glb")}>
              <Box /> glTF
            </Button>
          </div>
        </div>
        <Tabs defaultValue="3d">
          <TabsList>
            <TabsTrigger value="3d">Vista 3D</TabsTrigger>
            <TabsTrigger value="plano">Plano 2D</TabsTrigger>
          </TabsList>
          <TabsContent value="3d" className="pt-3">
            <TentViewer
              composition={composition}
              families={families}
              items={items}
              rules={rules}
              editable
              selectedTentId={selected}
              onSelectTent={setSelected}
              onChange={setComposition}
              apiRef={api}
              className="h-[62vh]"
            />
          </TabsContent>
          <TabsContent value="plano" className="pt-3">
            <TentPlan composition={composition} families={families} editable selectedTentId={selected} onSelectTent={setSelected} onChange={setComposition} className="h-[62vh]" />
          </TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          Haz clic en una lona de techo, un lateral o un frente para cambiar su tipo. Los huecos sin lona se marcan en color: haz clic en ellos para volver a ponerla. El despiece, el peso y las horas se recalculan al instante.
        </p>
      </div>

      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Dimensiones", `${fam.width} × ${tent.config.modules * fam.moduleLength} m`],
            ["Superficie", `${formatNumber(bom.totals.superficie)} m²`],
            ["Peso", `${formatNumber(bom.totals.weightKg)} kg`],
            ["Volumen", `${formatNumber(bom.totals.volumeM3)} m³`],
            ["Montaje", `${formatNumber(bom.totals.montajeHoras)} h·persona`],
            ["Desmontaje", `${formatNumber(bom.totals.desmontajeHoras)} h·persona`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-0.5 font-medium tabular">{v}</p>
            </div>
          ))}
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Artículo</TH>
              <TH className="text-right">Cant.</TH>
            </TR>
          </THead>
          <TBody>
            {bom.lines
              .slice()
              .sort((a, b) => a.group.localeCompare(b.group))
              .map((l) => (
                <TR key={l.itemId}>
                  <TD>
                    <p className="font-medium">{itemById.get(l.itemId)?.name ?? l.itemId}</p>
                    <p className="text-xs text-muted-foreground">{BOM_GROUP_LABELS[l.group]}</p>
                  </TD>
                  <TD className="text-right tabular">
                    {formatNumber(l.quantity)} {itemById.get(l.itemId)?.unit === "m2" ? "m²" : ""}
                  </TD>
                </TR>
              ))}
          </TBody>
        </Table>
        {bom.collisions.length > 0 && <p className="text-sm text-danger">Hay carpas solapadas en el plano.</p>}
        <Button variant="link" size="sm" asChild>
          <a href="#" onClick={(e) => (e.preventDefault(), api.current?.toGLTF().then((b) => download(b, "carpa.glb")))}>
            <Download /> Descargar modelo glTF
          </a>
        </Button>
      </aside>
    </div>
  );
}
