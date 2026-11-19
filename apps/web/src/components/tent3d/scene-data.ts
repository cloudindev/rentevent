/**
 * Turns a Composition into renderable data. Geometry always comes from
 * `generateTentParts` and is filtered by `coverPartsWithBom`, so nothing is
 * drawn that the BOM does not contain.
 */
import * as THREE from "three";
import {
  computeBom,
  coverPartsWithBom,
  generateTentParts,
  placeComposition,
  type BomItem,
  type BomRule,
  type Composition,
  type CoverageGap,
  type StructureFamily,
  type TentConfiguration,
  type TentPart,
  type Vec2,
} from "@rentevent/core";
import { sharedEdge } from "@rentevent/core/geometry/gutter";

export type MatKey =
  | "blanco"
  | "transparente"
  | "ventana_cristal"
  | "puerta_hueco"
  | "metal"
  | "madera"
  | "suelo"
  | "moqueta"
  | "hormigon"
  | "mesa"
  | "silla"
  | "canalon"
  | "hueco";

export type InstanceBatch = { shape: "box" | "cylinder"; mat: MatKey; matrices: THREE.Matrix4[] };

export type PickTarget = NonNullable<TentPart["target"]>;

export type SceneMesh = {
  key: string;
  tentId: string;
  target?: PickTarget;
  geometry: THREE.BufferGeometry;
  mat: MatKey;
  /** local → world transform */
  matrix: THREE.Matrix4;
  /** placeholder for an empty slot (no roof, open side, no front): clickable only while editing */
  ghost?: boolean;
};

export type TentInfo = {
  id: string;
  label: string;
  matrix: THREE.Matrix4;
  length: number;
  width: number;
  eave: number;
  ridge: number;
  isJaima: boolean;
  gaps: CoverageGap[];
  modules: number;
  minModules: number;
  maxModules: number;
};

export type SceneData = {
  batches: InstanceBatch[];
  meshes: SceneMesh[];
  tents: TentInfo[];
  bounds: THREE.Box3;
  gaps: CoverageGap[];
};

const UP = new THREE.Vector3(0, 1, 0);

function tentMatrix(x: number, y: number, rotationDeg: number) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, 0, y), new THREE.Quaternion().setFromAxisAngle(UP, (-rotationDeg * Math.PI) / 180), new THREE.Vector3(1, 1, 1));
  return m;
}

/** Unit cylinder (height 1, radius 1, centred) stretched between two points. */
function segmentMatrix(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(radius, len, radius));
}

function boxMatrix(x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, rotY), new THREE.Vector3(sx, sy, sz));
}

function roofGeometry(x0: number, x1: number, profile: Vec2[], lift = 0.03) {
  const pos: number[] = [];
  const idx: number[] = [];
  profile.forEach(([z, y], i) => {
    pos.push(x0, y + lift, z, x1, y + lift, z);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Vertical rectangle in the plane z = const, spanning x0..x1 and y0..y1. */
function wallGeometry(x0: number, x1: number, z: number, y0: number, y1: number) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  return g;
}

/** Vertical rectangle in the plane x = const. */
function frontGeometry(x: number, z0: number, z1: number, y0: number, y1: number) {
  const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0);
  g.rotateY(Math.PI / 2);
  g.translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

function gableGeometry(x: number, profile: Vec2[]) {
  const shape = new THREE.Shape();
  shape.moveTo(profile[0]![0], profile[0]![1]);
  for (const [z, y] of profile.slice(1)) shape.lineTo(z, y);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape);
  // shape lies in XY with x = z_local → rotate so it sits in the plane x = const
  g.rotateY(-Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

function addBatch(batches: Map<string, InstanceBatch>, shape: InstanceBatch["shape"], mat: MatKey, m: THREE.Matrix4) {
  const k = `${shape}:${mat}`;
  let b = batches.get(k);
  if (!b) batches.set(k, (b = { shape, mat, matrices: [] }));
  b.matrices.push(m);
}

/** Same configuration with every roof, side and front closed: used to know where empty slots are. */
function closedConfig(config: TentConfiguration): TentConfiguration {
  return {
    ...config,
    bays: config.bays.map((b) => ({ ...b, roof: b.roof === "ninguno" ? "blanco" : b.roof, left: b.left === "abierto" ? "blanco" : b.left, right: b.right === "abierto" ? "blanco" : b.right })),
    fronts: { start: { ...config.fronts.start, type: "completo" }, end: { ...config.fronts.end, type: "completo" } },
  };
}

export function buildScene(input: { composition: Composition; families: StructureFamily[]; items: BomItem[]; rules: BomRule[]; editable?: boolean }): SceneData {
  const fams = new Map(input.families.map((f) => [f.id, f]));
  const batches = new Map<string, InstanceBatch>();
  const meshes: SceneMesh[] = [];
  const tents: TentInfo[] = [];
  const allGaps: CoverageGap[] = [];
  const bounds = new THREE.Box3();

  for (const t of input.composition.tents) {
    const fam = fams.get(t.config.familyId);
    if (!fam) continue;
    const bom = computeBom({ config: t.config, family: fam, rules: input.rules, items: input.items });
    const parts = generateTentParts(t.config, fam);
    const { drawable, gaps } = coverPartsWithBom(parts, bom.lines, input.items);
    allGaps.push(...gaps);
    const T = tentMatrix(t.placement.x, t.placement.y, t.placement.rotation);
    const isJaima = fam.roofShape === "jaima";
    const length = isJaima ? fam.width : t.config.modules * fam.moduleLength;
    tents.push({ id: t.id, label: t.label || fam.name, matrix: T, length, width: fam.width, eave: fam.eaveHeight, ridge: fam.ridgeHeight, isJaima, gaps, modules: t.config.modules, minModules: fam.minModules, maxModules: fam.maxModules });
    const corners = [
      new THREE.Vector3(0, 0, -fam.width / 2),
      new THREE.Vector3(length, fam.ridgeHeight, fam.width / 2),
    ].map((v) => v.applyMatrix4(T));
    bounds.expandByPoint(corners[0]!).expandByPoint(corners[1]!);
    bounds.expandByPoint(new THREE.Vector3(length, 0, -fam.width / 2).applyMatrix4(T)).expandByPoint(new THREE.Vector3(0, 0, fam.width / 2).applyMatrix4(T));

    const world = (m: THREE.Matrix4) => new THREE.Matrix4().multiplyMatrices(T, m);
    const pushMesh = (key: string, geometry: THREE.BufferGeometry, mat: MatKey, target?: PickTarget) => meshes.push({ key: `${t.id}:${key}`, tentId: t.id, target, geometry, mat, matrix: T });

    // Empty slots (roof removed, open side, open or gable-less front) get a clickable placeholder
    // while editing, so a removed cover can always be put back. Never part of the BOM or exports.
    if (input.editable && !isJaima) {
      const present = new Set(parts.map((p) => p.id));
      for (const p of generateTentParts(closedConfig(t.config), fam)) {
        if (!p.target || present.has(p.id)) continue;
        const s = p.shape;
        const geometry =
          s.kind === "roof" ? roofGeometry(s.x0, s.x1, s.profile, 0.05) : s.kind === "wall" ? wallGeometry(s.x0, s.x1, s.z, 0, s.height) : s.kind === "gable" ? gableGeometry(s.x, s.profile) : s.kind === "frontwall" ? frontGeometry(s.x, s.z0, s.z1, 0, s.height) : null;
        if (geometry) meshes.push({ key: `${t.id}:ghost:${p.id}`, tentId: t.id, target: p.target, geometry, mat: "hueco", matrix: T, ghost: true });
      }
    }

    for (const p of drawable) {
      const s = p.shape;
      switch (s.kind) {
        case "post":
          addBatch(batches, "box", "metal", world(boxMatrix(s.x, s.height / 2, s.z, 0.13, s.height, 0.13)));
          break;
        case "truss": {
          const top = s.profile.map(([z, y]) => new THREE.Vector3(s.x, y, z));
          const depth = 0.38;
          const bottom = s.profile.map(([z, y], i) => new THREE.Vector3(s.x, i === 0 || i === s.profile.length - 1 ? y : y - depth, z * (i === 0 || i === s.profile.length - 1 ? 1 : 0.985)));
          for (let i = 1; i < top.length; i++) {
            addBatch(batches, "cylinder", "metal", world(segmentMatrix(top[i - 1]!, top[i]!, 0.07)));
            addBatch(batches, "cylinder", "metal", world(segmentMatrix(bottom[i - 1]!, bottom[i]!, 0.045)));
            // lattice: verticals and a diagonal per segment
            if (i < top.length - 1) addBatch(batches, "cylinder", "metal", world(segmentMatrix(top[i]!, bottom[i]!, 0.03)));
            addBatch(batches, "cylinder", "metal", world(segmentMatrix(bottom[i - 1]!, top[i]!, 0.025)));
          }
          break;
        }
        case "purlin":
          addBatch(batches, "box", "metal", world(boxMatrix((s.x0 + s.x1) / 2, s.y - 0.02, s.z, s.x1 - s.x0, 0.07, 0.07)));
          break;
        case "roof":
          pushMesh(p.id, roofGeometry(s.x0, s.x1, s.profile), p.material === "transparente" ? "transparente" : "blanco", p.target);
          break;
        case "wall": {
          const out = s.z < 0 ? -0.02 : 0.02;
          if (p.material === "transparente") pushMesh(p.id, wallGeometry(s.x0, s.x1, s.z, 0, s.height), "transparente", p.target);
          else if (p.material === "ventana") {
            pushMesh(p.id, wallGeometry(s.x0, s.x1, s.z, 0, s.height), "blanco", p.target);
            const w = (s.x1 - s.x0 - 0.9) / 2;
            for (let k = 0; k < 2; k++) {
              const x0 = s.x0 + 0.3 + k * (w + 0.3);
              pushMesh(`${p.id}-v${k}`, wallGeometry(x0, x0 + w, s.z + out, s.height * 0.38, s.height * 0.82), "ventana_cristal", p.target);
            }
          } else if (p.material === "puerta") {
            pushMesh(p.id, wallGeometry(s.x0, s.x1, s.z, 0, s.height), "blanco", p.target);
            const mid = (s.x0 + s.x1) / 2;
            pushMesh(`${p.id}-p`, wallGeometry(mid - 1, mid + 1, s.z + out, 0, Math.min(2.2, s.height - 0.2)), "puerta_hueco", p.target);
          } else pushMesh(p.id, wallGeometry(s.x0, s.x1, s.z, 0, s.height), "blanco", p.target);
          break;
        }
        case "gable":
          pushMesh(p.id, gableGeometry(s.x, s.profile), "blanco", p.target);
          break;
        case "frontwall":
          pushMesh(p.id, frontGeometry(s.x, s.z0, s.z1, 0, s.height), p.material === "transparente" ? "transparente" : "blanco", p.target);
          break;
        case "box": {
          const mat: MatKey = p.material === "hormigon" ? "hormigon" : p.material === "madera" ? "madera" : p.material === "suelo" ? "suelo" : p.material === "moqueta" ? "moqueta" : "metal";
          addBatch(batches, "box", mat, world(boxMatrix(s.x, s.y, s.z, s.sx, s.sy, s.sz, s.rotation)));
          break;
        }
        case "cylinder":
          if (p.role === "mesa") {
            addBatch(batches, "cylinder", "mesa", world(boxMatrix(s.x, s.y + s.height / 2 - 0.02, s.z, s.radius, 0.04, s.radius)));
            addBatch(batches, "cylinder", "metal", world(boxMatrix(s.x, s.y - 0.02, s.z, 0.04, s.height - 0.04, 0.04)));
          } else addBatch(batches, "cylinder", "metal", world(boxMatrix(s.x, s.y, s.z, s.radius, s.height, s.radius)));
          break;
        case "chair": {
          const rot = -s.rotation;
          const q = new THREE.Quaternion().setFromAxisAngle(UP, rot);
          const back = new THREE.Vector3(-0.2, 0, 0).applyQuaternion(q);
          addBatch(batches, "box", "silla", world(boxMatrix(s.x, 0.45, s.z, 0.44, 0.05, 0.44, rot)));
          addBatch(batches, "box", "silla", world(boxMatrix(s.x + back.x, 0.7, s.z + back.z, 0.04, 0.5, 0.44, rot)));
          const side = new THREE.Vector3(0, 0, 0.19).applyQuaternion(q);
          for (const sgn of [-1, 1]) addBatch(batches, "box", "metal", world(boxMatrix(s.x + side.x * sgn, 0.22, s.z + side.z * sgn, 0.4, 0.44, 0.02, rot)));
          break;
        }
        case "jaima": {
          const h = s.size / 2;
          for (const [x, z] of [
            [0, -h],
            [0, h],
            [s.size, -h],
            [s.size, h],
          ] as const)
            addBatch(batches, "box", "metal", world(boxMatrix(x, s.eave / 2, z, 0.1, s.eave, 0.1)));
          const cone = new THREE.ConeGeometry(h * Math.SQRT2, s.ridge - s.eave, 4, 1, true);
          cone.rotateY(Math.PI / 4);
          cone.translate(h, s.eave + (s.ridge - s.eave) / 2, 0);
          pushMesh(p.id, cone, "blanco");
          const sides: [number, number, number, number][] = [
            [0, s.size, -h, -h],
            [0, s.size, h, h],
          ];
          for (const [x0, x1, z] of sides) pushMesh(`${p.id}-l${z}`, wallGeometry(x0, x1, z, 0, s.eave), "blanco");
          pushMesh(`${p.id}-f0`, frontGeometry(0, -h, h, 0, s.eave), "blanco");
          pushMesh(`${p.id}-f1`, frontGeometry(s.size, -h, h, 0, s.eave), "blanco");
          break;
        }
      }
    }
  }

  // gutters between joined tents, at the lower eave height
  const placed = placeComposition(input.composition, fams);
  const byId = new Map(placed.map((p) => [p.id, p]));
  const tentById = new Map(tents.map((t) => [t.id, t]));
  const hasGutterItem = input.items.some((i) => i.role === "canalon");
  for (const g of hasGutterItem ? input.composition.gutters : []) {
    const a = byId.get(g.a);
    const b = byId.get(g.b);
    if (!a || !b) continue;
    const seg = sharedEdge(a, b, 0.2);
    if (!seg) continue;
    const y = Math.min(tentById.get(g.a)?.eave ?? 3, tentById.get(g.b)?.eave ?? 3);
    const pa = new THREE.Vector3(seg[0][0], y, seg[0][1]);
    const pb = new THREE.Vector3(seg[1][0], y, seg[1][1]);
    const dir = new THREE.Vector3().subVectors(pb, pa);
    const len = dir.length();
    const ang = Math.atan2(-dir.z, dir.x);
    addBatch(batches, "box", "canalon", boxMatrix((pa.x + pb.x) / 2, y + 0.05, (pa.z + pb.z) / 2, len, 0.18, 0.35, ang));
  }

  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
  return { batches: [...batches.values()], meshes, tents, bounds, gaps: allGaps };
}

let MATS: Record<MatKey, THREE.Material> | null = null;
export function materials(): Record<MatKey, THREE.Material> {
  if (MATS) return MATS;
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  MATS = {
    blanco: std({ color: "#fbfbf9", roughness: 0.9, metalness: 0 }),
    transparente: std({ color: "#cfe3f5", roughness: 0.1, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }),
    ventana_cristal: std({ color: "#a9c9e6", roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
    puerta_hueco: std({ color: "#3a3a38", roughness: 0.9 }),
    hueco: std({ color: "#f95f40", roughness: 1, transparent: true, opacity: 0.1, depthWrite: false }),
    metal: std({ color: "#8e9399", roughness: 0.45, metalness: 0.6 }),
    madera: std({ color: "#b78a5a", roughness: 0.8 }),
    suelo: std({ color: "#8d8f91", roughness: 0.9 }),
    moqueta: std({ color: "#7b2f3a", roughness: 1 }),
    hormigon: std({ color: "#a7a49c", roughness: 1 }),
    mesa: std({ color: "#fbfbf8", roughness: 0.6 }),
    silla: std({ color: "#ffffff", roughness: 0.5 }),
    canalon: std({ color: "#9aa3ad", roughness: 0.4, metalness: 0.6 }),
  };
  return MATS;
}

let GEOMS: { box: THREE.BufferGeometry; cylinder: THREE.BufferGeometry } | null = null;
export function unitGeometries() {
  if (!GEOMS) GEOMS = { box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 12) };
  return GEOMS;
}
