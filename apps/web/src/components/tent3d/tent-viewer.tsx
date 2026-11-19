"use client";
import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Maximize2, Minus, MousePointerClick, Plus, TriangleAlert } from "lucide-react";
import type { BomItem, BomRule, Composition, StructureFamily } from "@rentevent/core";
import { cn } from "@/lib/utils";
import { applyPick, changeModules, describeTarget } from "./edit";
import { buildScene, materials, unitGeometries, type InstanceBatch, type MatKey, type PickTarget, type SceneData, type SceneMesh } from "./scene-data";

export type TentViewerApi = { toPNG(): Promise<Blob>; toGLTF(): Promise<Blob> };

export type TentViewerProps = {
  composition: Composition;
  families: StructureFamily[];
  items: BomItem[];
  rules: BomRule[];
  editable?: boolean;
  selectedTentId?: string | null;
  onChange?: (c: Composition) => void;
  onSelectTent?: (id: string) => void;
  showHuman?: boolean;
  showDimensions?: boolean;
  className?: string;
  apiRef?: React.Ref<TentViewerApi>;
};

const BRAND = "#f95f40";
const ROLE_LABEL: Record<string, string> = {
  cercha: "cerchas",
  pilar: "pilares",
  placa_base: "placas base",
  correa: "correas",
  lona_techo_blanca: "lonas de techo blancas",
  lona_techo_transparente: "lonas de techo transparentes",
  lateral_blanco: "laterales blancos",
  lateral_transparente: "laterales transparentes",
  lateral_ventana: "laterales con ventana",
  lateral_puerta: "laterales con puerta",
  pico: "picos",
  frontal_blanco: "frontales blancos",
  frontal_transparente: "frontales transparentes",
  peso: "pesos",
  estaca: "estacas",
  tarima: "tarima",
  suelo: "suelo",
  moqueta: "moqueta",
  escenario: "escenario",
  mesa: "mesas",
  silla: "sillas",
  jaima: "jaimas",
};

let HL: Partial<Record<MatKey, THREE.Material>> = {};
function highlight(mat: MatKey): THREE.Material {
  if (!HL[mat]) {
    const base = materials()[mat] as THREE.MeshStandardMaterial;
    const m = base.clone();
    m.emissive = new THREE.Color(BRAND);
    m.emissiveIntensity = 0.45;
    if (m.transparent) m.opacity = Math.min(0.6, m.opacity + 0.2);
    HL[mat] = m;
  }
  return HL[mat]!;
}

function Batch({ batch }: { batch: InstanceBatch }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = unitGeometries()[batch.shape];
  const mat = materials()[batch.mat];
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    batch.matrices.forEach((x, i) => m.setMatrixAt(i, x));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [batch]);
  return <instancedMesh key={batch.matrices.length} ref={ref} args={[geom, mat, batch.matrices.length]} castShadow={batch.mat !== "transparente"} receiveShadow frustumCulled={false} />;
}

function PickMesh({ mesh, hovered, interactive, onHover, onPick }: { mesh: SceneMesh; hovered: boolean; interactive: boolean; onHover: (m: SceneMesh | null) => void; onPick: (m: SceneMesh, e: ThreeEvent<MouseEvent>) => void }) {
  const mat = hovered ? highlight(mesh.mat) : materials()[mesh.mat];
  return (
    <mesh
      geometry={mesh.geometry}
      material={mat}
      matrix={mesh.matrix}
      matrixAutoUpdate={false}
      castShadow={mesh.mat === "blanco"}
      receiveShadow={!mesh.ghost}
      userData={mesh.ghost ? { helper: true, ghost: true } : undefined}
      renderOrder={mesh.mat === "transparente" || mesh.mat === "ventana_cristal" || mesh.ghost ? 2 : 0}
      onPointerOver={
        interactive
          ? (e) => {
              e.stopPropagation();
              onHover(mesh);
            }
          : undefined
      }
      onPointerOut={interactive ? () => onHover(null) : undefined}
      onClick={(e) => onPick(mesh, e)}
    />
  );
}

function Human({ position }: { position: THREE.Vector3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.78, 0]} castShadow>
        <capsuleGeometry args={[0.17, 1.1, 4, 12]} />
        <meshStandardMaterial color="#4b5563" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color="#4b5563" roughness={0.8} />
      </mesh>
      <Label position={[0, 2.2, 0]} text="1,75 m" size={0.5} />
    </group>
  );
}

const labelCache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();
function labelTexture(text: string) {
  let hit = labelCache.get(text);
  if (hit) return hit;
  const scale = 4;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  const font = `500 ${11 * scale}px Inter, system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 14 * scale;
  const h = 22 * scale;
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.strokeStyle = "#d6d6d2";
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.roundRect(scale / 2, scale / 2, w - scale, h - scale, 6 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, w / 2, h / 2 + scale);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  hit = { tex, aspect: w / h };
  labelCache.set(text, hit);
  return hit;
}

/** Text pill rendered as a sprite (WebGL, so it is part of PNG exports). */
function Label({ position, text, size = 0.7 }: { position: [number, number, number]; text: string; size?: number }) {
  const { tex, aspect } = useMemo(() => labelTexture(text), [text]);
  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
}

function Dimensions({ data, tentId }: { data: SceneData; tentId: string | null }) {
  const tents = tentId ? data.tents.filter((t) => t.id === tentId) : data.tents.slice(0, 1);
  return (
    <>
      {tents.map((t) => {
        const w = (v: [number, number, number]) => new THREE.Vector3(...v).applyMatrix4(t.matrix);
        const hw = t.width / 2;
        const off = 1.2;
        const a1 = w([0, 0.05, -hw - off]);
        const a2 = w([t.length, 0.05, -hw - off]);
        const b1 = w([-off, 0.05, -hw]);
        const b2 = w([-off, 0.05, hw]);
        const h1 = w([-0.4, 0, -hw - 0.4]);
        const h2 = w([-0.4, t.eave, -hw - 0.4]);
        const ls = Math.min(1.8, Math.max(0.6, Math.max(t.length, t.width) / 24));
        const fmt = (n: number) => `${Math.round(n * 100) / 100}`.replace(".", ",");
        return (
          <group key={t.id}>
            <Line points={[a1, a2]} color="#525252" lineWidth={1} />
            <Line points={[b1, b2]} color="#525252" lineWidth={1} />
            <Line points={[h1, h2]} color="#525252" lineWidth={1} dashed dashSize={0.2} gapSize={0.12} />
            <Label size={ls} position={a1.clone().lerp(a2, 0.5).setY(0.5).toArray()} text={`Largo ${fmt(t.length)} m`} />
            <Label size={ls} position={b1.clone().lerp(b2, 0.5).setY(0.5).toArray()} text={`Ancho ${fmt(t.width)} m`} />
            <Label size={ls} position={h1.clone().lerp(h2, 0.6).toArray()} text={`Altura ${fmt(t.eave)} m`} />
          </group>
        );
      })}
    </>
  );
}

function SelectionOutline({ data, tentId }: { data: SceneData; tentId: string | null | undefined }) {
  const t = data.tents.find((x) => x.id === tentId);
  if (!t) return null;
  const hw = t.width / 2;
  const pts = [
    [0, 0.03, -hw],
    [t.length, 0.03, -hw],
    [t.length, 0.03, hw],
    [0, 0.03, hw],
    [0, 0.03, -hw],
  ].map((p) => new THREE.Vector3(...(p as [number, number, number])).applyMatrix4(t.matrix));
  return <Line points={pts} color={BRAND} lineWidth={2.5} />;
}

type Bridge = { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; invalidate: () => void; fit: () => void };

function SceneBridge({ bridgeRef, bounds, fitKey }: { bridgeRef: React.MutableRefObject<Bridge | null>; bounds: THREE.Box3; fitKey: string }) {
  const { gl, scene, camera, invalidate, controls } = useThree();
  const fit = useMemo(
    () => () => {
      const c = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const d = Math.max(size.x, size.z, 8);
      const dist = d * 1.25 + 6;
      const dir = new THREE.Vector3(-0.55, 0.5, 0.85).normalize();
      camera.position.set(c.x + dir.x * dist, Math.max(size.y * 1.8, dir.y * dist), c.z + dir.z * dist);
      camera.lookAt(c.x, size.y * 0.3, c.z);
      const ctl = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
      if (ctl?.target) {
        ctl.target.set(c.x, size.y * 0.3, c.z);
        ctl.update?.();
      }
      invalidate();
    },
    [bounds, camera, controls, invalidate],
  );
  useEffect(() => {
    bridgeRef.current = { gl, scene, camera, invalidate, fit };
  }, [gl, scene, camera, invalidate, fit, bridgeRef]);
  // refit when the footprint changes a lot (new tent, family switch), not on every edit
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, controls]);
  return null;
}

function Lights({ bounds }: { bounds: THREE.Box3 }) {
  const c = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.z) * 0.75 + 10;
  const light = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.copy(c);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera as THREE.OrthographicCamera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.far = r * 4;
    cam.updateProjectionMatrix();
  }, [c, r]);
  return (
    <>
      <hemisphereLight args={["#eaf2ff", "#8f9a80", 1.5]} />
      <directionalLight ref={light} position={[c.x - r * 0.6, r * 1.2, c.z + r * 0.8]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
    </>
  );
}

export default function TentViewer(props: TentViewerProps) {
  const { composition, families, items, rules, editable, selectedTentId, onChange, onSelectTent, showHuman = true, showDimensions = true, className, apiRef } = props;
  const data = useMemo(() => buildScene({ composition, families, items, rules, editable }), [composition, families, items, rules, editable]);
  const [hover, setHover] = useState<SceneMesh | null>(null);
  const bridge = useRef<Bridge | null>(null);
  const famById = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);

  // dispose per-build geometries when they are replaced
  useEffect(() => () => data.meshes.forEach((m) => m.geometry.dispose()), [data]);
  useEffect(() => () => {
    HL = {};
  }, []);

  useImperativeHandle(
    apiRef,
    () => ({
      async toPNG() {
        const b = bridge.current;
        if (!b) throw new Error("Visor no listo");
        // empty-slot placeholders are an editing aid, not part of the tent
        const ghosts: THREE.Object3D[] = [];
        b.scene.traverse((o) => {
          if (o.userData?.ghost && o.visible) ghosts.push(o);
        });
        ghosts.forEach((o) => (o.visible = false));
        b.gl.render(b.scene, b.camera);
        const blob = new Promise<Blob>((res, rej) => b.gl.domElement.toBlob((x) => (x ? res(x) : rej(new Error("PNG vacío"))), "image/png"));
        ghosts.forEach((o) => (o.visible = true));
        return blob;
      },
      async toGLTF() {
        const b = bridge.current;
        if (!b) throw new Error("Visor no listo");
        const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
        const exportRoot = new THREE.Group();
        b.scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && o.visible && !(o.userData?.helper)) {
            const clone = (o as THREE.Mesh).clone();
            o.updateWorldMatrix(true, false);
            clone.matrixAutoUpdate = false;
            clone.matrix.copy(o.matrixWorld);
            exportRoot.add(clone);
          }
        });
        const out = await new GLTFExporter().parseAsync(exportRoot, { binary: true });
        return new Blob([out as ArrayBuffer], { type: "model/gltf-binary" });
      },
    }),
    [],
  );

  const selected = selectedTentId ?? (composition.tents.length === 1 ? composition.tents[0]!.id : null);
  const selectedInfo = data.tents.find((t) => t.id === selected);
  const humanPos = useMemo(() => {
    const t = data.tents[0];
    if (!t) return new THREE.Vector3(0, 0, 0);
    return new THREE.Vector3(-1.5, 0, -t.width / 2 - 1.5).applyMatrix4(t.matrix);
  }, [data]);

  const fitKey = composition.tents.map((t) => `${t.id}:${t.config.familyId}`).join(",");

  const onPick = (mesh: SceneMesh, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // it was an orbit drag
    onSelectTent?.(mesh.tentId);
    if (editable && mesh.target && onChange) onChange(applyPick(composition, mesh.tentId, mesh.target as PickTarget));
  };

  const gapRoles = [...new Set(data.gaps.map((g) => g.role))];

  return (
    <div className={cn("relative h-full min-h-[320px] w-full overflow-hidden rounded-xl border bg-[#e6ebef]", className)}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop="demand"
        gl={{ preserveDrawingBuffer: true, antialias: true, toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.1, far: 3000, position: [-20, 14, 26] }}
        onPointerMissed={() => setHover(null)}
        aria-label="Vista 3D de la carpa"
      >
        <color attach="background" args={["#e6ebef"]} />
        <fog attach="fog" args={["#e6ebef", 180, 700]} />
        <Lights bounds={data.bounds} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow userData={{ helper: true }}>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color="#b7c2a6" roughness={1} />
        </mesh>
        {data.batches.map((b) => (
          <Batch key={`${b.shape}:${b.mat}:${b.matrices.length}`} batch={b} />
        ))}
        {data.meshes.map((m) => (
          <PickMesh
            key={m.key}
            mesh={m}
            interactive={Boolean(editable && m.target)}
            hovered={Boolean(hover && hover.tentId === m.tentId && m.target && hover.target && JSON.stringify(hover.target) === JSON.stringify(m.target))}
            onHover={setHover}
            onPick={onPick}
          />
        ))}
        <SelectionOutline data={data} tentId={composition.tents.length > 1 ? selected : null} />
        {showDimensions && <Dimensions data={data} tentId={selected} />}
        {showHuman && data.tents.length > 0 && <Human position={humanPos} />}
        <OrbitControls makeDefault enableDamping={false} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={3} maxDistance={600} />
        <SceneBridge bridgeRef={bridge} bounds={data.bounds} fitKey={fitKey} />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          {gapRoles.length > 0 && (
            <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-2.5 py-1 text-[11px] font-medium text-warning shadow-sm" title="Estas piezas no se dibujan porque no están en el despiece">
              <TriangleAlert className="size-3.5" /> Sin despiece: {gapRoles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}
            </span>
          )}
          {editable && hover?.target && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] shadow-sm">
              <MousePointerClick className="size-3.5 text-brand-600" /> {describeTarget(hover.target)} · clic para cambiar
            </span>
          )}
        </div>
        <button className="pointer-events-auto rounded-lg border bg-white/95 p-1.5 text-neutral-700 shadow-sm hover:bg-white" onClick={() => bridge.current?.fit()} aria-label="Encuadrar" title="Encuadrar">
          <Maximize2 className="size-4" />
        </button>
      </div>

      {editable && selectedInfo && !selectedInfo.isJaima && onChange && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-white/95 p-1 text-sm text-neutral-900 shadow-md">
          <button
            className="rounded-lg p-1.5 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Quitar módulo"
            disabled={selectedInfo.modules <= selectedInfo.minModules}
            onClick={() => onChange(changeModules(composition, selectedInfo.id, -1, famById.get(composition.tents.find((t) => t.id === selectedInfo.id)!.config.familyId)!))}
          >
            <Minus className="size-4" />
          </button>
          <span className="min-w-28 px-1 text-center tabular-nums">
            {selectedInfo.modules} módulo{selectedInfo.modules === 1 ? "" : "s"} · {Math.round(selectedInfo.width)}x{Math.round(selectedInfo.length)}
          </span>
          <button
            className="rounded-lg p-1.5 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Añadir módulo"
            disabled={selectedInfo.modules >= selectedInfo.maxModules}
            onClick={() => onChange(changeModules(composition, selectedInfo.id, 1, famById.get(composition.tents.find((t) => t.id === selectedInfo.id)!.config.familyId)!))}
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
