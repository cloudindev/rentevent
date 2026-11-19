/**
 * Demo seed: one tent company (first customer catalogue) with users, stock,
 * tent families, BOM rules, contacts, crew, projects, orders, reservations,
 * finance and communication data. Idempotent: wipes the demo tenant first.
 *
 *   Demo login: demo@rentevent.es / Rentevent2026!
 */
import "./env";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import {
  computeBom,
  DEFAULT_PRICING,
  defaultConfiguration,
  laborLine,
  quoteTotals,
  tentQuoteLines,
  transportLine,
  zonedTime,
  type Composition,
  type PriceMode,
  type TentConfiguration,
} from "@rentevent/core";
import { fixtureFamilies, fixtureItems, fixturePricePerM2, fixtureRules, fixtureVehicles } from "@rentevent/core/fixtures/asturias";
import { eq, inArray } from "drizzle-orm";
import { closeDb, systemDb, type Tx, withTenant } from "../src/client";
import * as s from "../src/schema";

export const DEMO = {
  tenantId: "org_demo_carpasdelnorte",
  slug: "carpasdelnorte",
  name: "Carpas del Norte",
  password: "Rentevent2026!",
  users: [
    { id: "usr_demo_admin", name: "Lucía Fernández", email: "demo@rentevent.es", role: "administrador" },
    { id: "usr_demo_comercial", name: "Marcos Álvarez", email: "comercial@rentevent.es", role: "comercial" },
    { id: "usr_demo_almacen", name: "Iván Suárez", email: "almacen@rentevent.es", role: "jefe_almacen" },
    { id: "usr_demo_jefe", name: "Rubén Menéndez", email: "jefe@rentevent.es", role: "jefe_equipo" },
    { id: "usr_demo_montador", name: "Adrián García", email: "montador@rentevent.es", role: "montador" },
    { id: "usr_demo_lectura", name: "Paula Díaz", email: "lectura@rentevent.es", role: "solo_lectura" },
  ],
};

const H = 3_600_000;
const D = 24 * H;
const at = (y: number, m: number, d: number, hh = 8, mm = 0) => new Date(zonedTime(y, m, d, hh, mm));

async function wipe() {
  const db = systemDb();
  await db.delete(s.organization).where(eq(s.organization.id, DEMO.tenantId));
  await db.delete(s.user).where(inArray(s.user.email, DEMO.users.map((u) => u.email)));
}

async function createIdentity() {
  const db = systemDb();
  await db.insert(s.organization).values({ id: DEMO.tenantId, name: DEMO.name, slug: DEMO.slug });
  const hash = await hashPassword(DEMO.password);
  for (const u of DEMO.users) {
    await db.insert(s.user).values({ id: u.id, name: u.name, email: u.email, emailVerified: true });
    await db.insert(s.account).values({ id: `acc_${u.id}`, accountId: u.id, providerId: "credential", userId: u.id, password: hash });
    await db.insert(s.member).values({ id: `mem_${u.id}`, organizationId: DEMO.tenantId, userId: u.id, role: u.role });
  }
}

type Ids = {
  items: Map<string, string>;
  families: Map<string, string>;
  contacts: Record<string, string>;
  venues: Record<string, string>;
  workers: string[];
  vehicles: string[];
  warehouse: string;
};

async function catalogue(tx: Tx): Promise<Pick<Ids, "items" | "families" | "warehouse">> {
  const [wh] = await tx.insert(s.warehouses).values({ name: "Nave de Lugones", address: "Polígono de Silvota, Llanera (Asturias)", lat: 43.4237, lng: -5.8152 }).returning();
  const items = new Map<string, string>();
  let shelf = 0;
  for (const it of fixtureItems) {
    const [row] = await tx
      .insert(s.items)
      .values({
        sku: it.sku,
        name: it.name,
        category: it.category,
        kind: it.kind,
        unit: it.unit,
        role: it.role,
        roleAmount: it.roleAmount ?? 1,
        weightKg: it.weightKg,
        volumeM3: it.volumeM3,
        price: it.price,
        priceMode: it.priceMode,
        costPrice: Math.round(it.price * 0.25 * 100) / 100,
        replacementCost: Math.round((it.weightKg * 6 + it.price * 10) * 100) / 100,
        stockTotal: it.stock,
        stockRepair: it.id === "item-c10b" ? 0 : it.id === "item-lat-b-trans" ? 2 : 0,
        warehouseId: wh!.id,
        location: `${String.fromCharCode(65 + (shelf % 6))}-${String(Math.floor(shelf++ / 6) + 1).padStart(2, "0")}`,
        pendingValidation: Boolean(it.pendingValidation),
        inspectionIntervalDays: it.role === "cercha" ? 365 : it.category === "Lonas" ? 180 : it.kind === "seriado" ? 365 : null,
      })
      .returning({ id: s.items.id });
    items.set(it.id, row!.id);
    if (it.kind === "seriado") {
      const units = Math.min(it.stock, 12);
      for (let n = 1; n <= units; n++) {
        const serial = `${it.sku}-${String(n).padStart(3, "0")}`;
        await tx.insert(s.itemUnits).values({ itemId: row!.id, serial, qrCode: `RV-${serial}`, status: n === units && it.sku === "CAL-30" ? "reparacion" : "disponible" });
      }
    }
  }
  const families = new Map<string, string>();
  let order = 0;
  for (const f of fixtureFamilies) {
    const [row] = await tx
      .insert(s.structureFamilies)
      .values({
        code: f.code,
        name: f.name,
        width: f.width,
        moduleLength: f.moduleLength,
        eaveHeight: f.eaveHeight,
        ridgeHeight: f.ridgeHeight,
        heightClass: f.heightClass,
        roofShape: f.roofShape,
        trussItemId: f.trussItemId ? items.get(f.trussItemId)! : null,
        minModules: f.minModules,
        maxModules: f.maxModules,
        parameters: f.parameters,
        labor: f.labor,
        priceMode: "m2",
        price: f.roofShape === "jaima" ? 0 : fixturePricePerM2[f.id] ?? 8,
        sortOrder: order++,
        parametersPending: true,
      })
      .returning({ id: s.structureFamilies.id });
    families.set(f.id, row!.id);
  }
  for (const r of fixtureRules) {
    await tx.insert(s.bomRules).values({
      familyId: families.get(r.familyId)!,
      itemId: items.get(r.itemId)!,
      formula: r.formula,
      condition: r.condition,
      group: r.group,
      sortOrder: r.sortOrder,
      note: r.note,
    });
  }
  return { items, families, warehouse: wh!.id };
}

/** Converts a fixture configuration to DB ids. */
const toDbConfig = (c: TentConfiguration, families: Map<string, string>): TentConfiguration => ({ ...c, familyId: families.get(c.familyId)! });

async function main() {
  await wipe();
  await createIdentity();
  await withTenant(DEMO.tenantId, async (tx) => {
    await tx.insert(s.tenantSettings).values({
      legalName: "Carpas del Norte, S.L.",
      taxId: "B33000000",
      address: "Polígono de Silvota, parcela 12",
      city: "Llanera",
      province: "Asturias",
      postalCode: "33192",
      phone: "+34 985 000 000",
      email: "hola@carpasdelnorte.example",
      website: "https://carpasdelnorte.example",
      iban: "ES00 0000 0000 0000 0000 0000",
      baseLat: 43.4237,
      baseLng: -5.8152,
      pricing: DEFAULT_PRICING,
      quoteTerms:
        "Precios sin IVA. Incluye montaje y desmontaje en horario laborable. El terreno debe estar nivelado y accesible para camión. La reserva se confirma con un anticipo del 30 %. Validez de la oferta: 30 días.",
      plan: "profesional",
      planSeats: 15,
      modules: ["carpas", "personal", "almacen", "finanzas", "ia"],
      trialEndsAt: new Date(Date.now() + 14 * D),
      subscriptionStatus: "trialing",
      onboardingDone: true,
      onboardingStep: 6,
    });
    await tx.insert(s.counters).values([
      { key: "pedido", value: 262040 },
      { key: "proyecto", value: 0 },
      { key: "albaran", value: 0 },
    ]);

    const cat = await catalogue(tx);
    const ids: Ids = { ...cat, contacts: {}, venues: {}, workers: [], vehicles: [] };

    // ── Contacts
    const contactRows: { key: string; kind: string; name: string; taxId?: string; email?: string; phone?: string; city: string; address: string; discount?: number; person?: string }[] = [
      { key: "ayto", kind: "cliente", name: "Ayuntamiento de Valdecastro", taxId: "P3300000A", email: "festejos@valdecastro.example", phone: "985 111 222", city: "Villaviciosa", address: "Plaza del Ayuntamiento 1, Villaviciosa", discount: 5, person: "Nuria Prieto" },
      { key: "festival", kind: "cliente", name: "Asociación Festival del Faro", taxId: "G33111111", email: "produccion@festivaldelfaro.example", phone: "684 000 111", city: "Gijón", address: "Paseo del Muro 20, Gijón", person: "Diego Sanz" },
      { key: "hotel", kind: "cliente", name: "Hotel Playa Mayor", taxId: "B33222222", email: "eventos@hotelplayamayor.example", phone: "985 333 444", city: "Llanes", address: "Avenida de la Playa 5, Llanes", discount: 8, person: "Carmen Rato" },
      { key: "bodas", kind: "cliente", name: "Bodas con Encanto Asturias", taxId: "B33333333", email: "info@bodasconencanto.example", phone: "622 555 666", city: "Oviedo", address: "Calle Uría 40, Oviedo", discount: 10, person: "Elena Morán" },
      { key: "feria", kind: "cliente", name: "Recinto Ferial del Cantábrico", taxId: "Q3300001B", email: "ferias@recintocantabrico.example", phone: "985 777 888", city: "Gijón", address: "Avenida del Molinón s/n, Gijón", person: "Javier Cueto" },
      { key: "club", kind: "cliente", name: "Club de Golf Las Mestas", taxId: "G33444444", email: "secretaria@golflasmestas.example", phone: "985 999 000", city: "Gijón", address: "Camino de las Mestas, Gijón", person: "Sergio Llana" },
      { key: "particular", kind: "cliente", name: "Ana Rodríguez Pérez", taxId: "00000000T", email: "ana.rodriguez@correo.example", phone: "655 123 456", city: "Cangas de Onís", address: "Barrio de Contranquil, Cangas de Onís" },
      { key: "prov_carpas", kind: "proveedor", name: "Estructuras Cantábricas, S.L.", taxId: "B39555555", email: "alquiler@estructurascantabricas.example", phone: "942 000 111", city: "Santander", address: "Polígono de Raos, Santander", person: "Óscar Ruiz" },
      { key: "prov_mobiliario", kind: "proveedor", name: "Mobiliario para Eventos León", taxId: "B24666666", email: "pedidos@mobiliarioleon.example", phone: "987 000 222", city: "León", address: "Polígono Onzonilla, León" },
      { key: "prov_lonas", kind: "proveedor", name: "Lonas y Toldos del Norte", taxId: "B33777777", email: "taller@lonasnorte.example", phone: "985 444 555", city: "Avilés", address: "Calle de la Industria 8, Avilés" },
      { key: "loc_plaza", kind: "localizacion", name: "Plaza Mayor de Valdecastro", city: "Villaviciosa", address: "Plaza Mayor, Villaviciosa" },
    ];
    for (const c of contactRows) {
      const [row] = await tx
        .insert(s.contacts)
        .values({ kind: c.kind, name: c.name, taxId: c.taxId ?? null, email: c.email ?? null, phone: c.phone ?? null, discountPct: c.discount ?? 0, tags: c.kind === "cliente" ? ["2026"] : [] })
        .returning({ id: s.contacts.id });
      ids.contacts[c.key] = row!.id;
      const geo = { Villaviciosa: [43.4813, -5.4357], Gijón: [43.5322, -5.6611], Llanes: [43.4198, -4.7549], Oviedo: [43.3614, -5.8494], "Cangas de Onís": [43.3507, -5.1286], Santander: [43.4623, -3.81], León: [42.5987, -5.5671], Avilés: [43.5547, -5.9248] }[c.city] as [number, number];
      await tx.insert(s.contactAddresses).values({ contactId: row!.id, line1: c.address, city: c.city, province: c.city === "Santander" ? "Cantabria" : c.city === "León" ? "León" : "Asturias", lat: geo[0], lng: geo[1], isDefault: true });
      if (c.person) await tx.insert(s.contactPersons).values({ contactId: row!.id, name: c.person, position: c.kind === "proveedor" ? "Comercial" : "Responsable de eventos", email: c.email ?? null, phone: c.phone ?? null });
    }

    // ── Venues
    const venueRows = [
      { key: "plaza", name: "Plaza Mayor de Valdecastro", city: "Villaviciosa", lat: 43.4813, lng: -5.4357, ground: "adoquin", anchoring: false, notes: "Acceso por calle lateral; camión máximo 12 t. Prohibido perforar: montar con pesos." },
      { key: "muro", name: "Explanada del Muro", city: "Gijón", lat: 43.5395, lng: -5.6555, ground: "asfalto", anchoring: false, notes: "Carga y descarga antes de las 9:00." },
      { key: "finca", name: "Finca La Quintana", city: "Llanes", lat: 43.4255, lng: -4.77, ground: "cesped", anchoring: true, notes: "Terreno con ligera pendiente en la zona norte. Tomas de agua junto al hórreo." },
      { key: "ferial", name: "Recinto Ferial del Cantábrico · Pabellón exterior", city: "Gijón", lat: 43.5296, lng: -5.6371, ground: "hormigon", anchoring: true, notes: "Anclaje químico permitido con autorización del recinto." },
      { key: "golf", name: "Club de Golf Las Mestas · Terraza", city: "Gijón", lat: 43.5355, lng: -5.6411, ground: "cesped", anchoring: true, notes: "No pisar el green con vehículos." },
      { key: "covadonga", name: "Prado de Contranquil", city: "Cangas de Onís", lat: 43.3507, lng: -5.1286, ground: "cesped", anchoring: true, notes: "Acceso estrecho: furgoneta hasta el prado, camión en la carretera." },
    ];
    for (const v of venueRows) {
      const [row] = await tx
        .insert(s.venues)
        .values({ name: v.name, address: `${v.name}, ${v.city}`, city: v.city, lat: v.lat, lng: v.lng, groundType: v.ground, anchoringAllowed: v.anchoring, accessNotes: v.notes })
        .returning({ id: s.venues.id });
      ids.venues[v.key] = row!.id;
    }

    // ── Vehicles
    for (const v of fixtureVehicles) {
      const [row] = await tx
        .insert(s.vehicles)
        .values({
          name: v.name,
          plate: v.id === "veh-trailer" ? "1234 LMN" : v.id === "veh-camion-grua" ? "5678 KJH" : "9012 MPS",
          kind: v.id === "veh-furgoneta" ? "furgoneta" : "camion",
          maxPayloadKg: v.maxPayloadKg,
          volumeM3: v.volumeM3,
          licenceRequired: v.id === "veh-trailer" ? "conductor_ce" : v.id === "veh-camion-grua" ? "conductor_c" : "conductor_b",
          itvUntil: "2027-05-30",
          costPerKm: v.id === "veh-furgoneta" ? 0.35 : 0.95,
        })
        .returning({ id: s.vehicles.id });
      ids.vehicles.push(row!.id);
    }

    // ── Workers
    const workerRows: { name: string; type: string; skills: string[]; training: string | null; cost: number; city: [number, number]; userId?: string }[] = [
      { name: "Rubén Menéndez", type: "plantilla", skills: ["jefe_equipo", "montador", "conductor_c", "trabajos_altura"], training: "2027-09-30", cost: 22, city: [43.3614, -5.8494], userId: "usr_demo_jefe" },
      { name: "Adrián García", type: "plantilla", skills: ["montador", "conductor_b", "trabajos_altura"], training: "2027-03-15", cost: 18, city: [43.4029, -5.8113], userId: "usr_demo_montador" },
      { name: "Héctor Fernández", type: "plantilla", skills: ["jefe_equipo", "montador", "conductor_ce", "carretillero"], training: "2027-06-01", cost: 23, city: [43.5322, -5.6611] },
      { name: "Óscar Prieto", type: "plantilla", skills: ["montador", "carretillero", "gruista", "conductor_c"], training: "2027-01-20", cost: 19, city: [43.392, -5.6627] },
      { name: "Daniel Alonso", type: "plantilla", skills: ["montador", "trabajos_altura"], training: "2026-10-31", cost: 17, city: [43.5547, -5.9248] },
      { name: "Javier Iglesias", type: "eventual", skills: ["montador"], training: "2027-02-28", cost: 15, city: [43.2502, -5.7767] },
      { name: "Sara López", type: "plantilla", skills: ["montador", "conductor_b", "carretillero"], training: "2027-04-10", cost: 18, city: [43.4366, -5.8563] },
      { name: "Mario Cuesta", type: "eventual", skills: ["montador", "trabajos_altura"], training: "2027-07-07", cost: 15, city: [43.296, -5.6828] },
      { name: "Pelayo Vigil", type: "autonomo", skills: ["jefe_equipo", "montador", "conductor_c"], training: "2027-12-01", cost: 26, city: [43.4198, -4.7549] },
      { name: "Nicolás Rubio", type: "eventual", skills: ["montador"], training: null, cost: 14, city: [43.3507, -5.1286] },
      { name: "Bruno Castro", type: "plantilla", skills: ["montador", "conductor_c", "carretillero"], training: "2027-05-05", cost: 19, city: [43.3955, -5.7106] },
      { name: "Iker Solís", type: "eventual", skills: ["montador", "trabajos_altura"], training: "2027-08-18", cost: 15, city: [43.5888, -5.7635] },
    ];
    const colors = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#65a30d", "#7c3aed", "#0d9488", "#ca8a04", "#4f46e5", "#be123c"];
    for (const [i, w] of workerRows.entries()) {
      const [row] = await tx
        .insert(s.workers)
        .values({
          userId: w.userId ?? null,
          name: w.name,
          email: w.userId ? DEMO.users.find((u) => u.id === w.userId)!.email : `${w.name.split(" ")[0]!.toLowerCase()}@carpasdelnorte.example`,
          phone: `6${String(10000000 + i * 1234567).slice(0, 8)}`,
          type: w.type,
          skills: w.skills,
          trainingExpiresAt: w.training,
          costPerHour: w.cost,
          weeklyHoursLimit: w.type === "autonomo" ? 50 : 40,
          homeLat: w.city[0],
          homeLng: w.city[1],
          color: colors[i % colors.length]!,
        })
        .returning({ id: s.workers.id });
      ids.workers.push(row!.id);
    }
    await tx.insert(s.workerUnavailability).values([
      { workerId: ids.workers[6]!, kind: "vacaciones", startsAt: at(2026, 12, 21, 0), endsAt: at(2027, 1, 7, 0), note: "Vacaciones de Navidad" },
      { workerId: ids.workers[7]!, kind: "baja", startsAt: at(2026, 11, 16, 0), endsAt: at(2026, 11, 28, 0), note: "Baja médica" },
    ]);

    await seedProjects(tx, ids);
    await seedFinance(tx, ids);
    await seedOps(tx, ids);
  });
  console.log(`Seed listo · ${DEMO.name} (${DEMO.slug}) · acceso: ${DEMO.users[0]!.email} / ${DEMO.password}`);
}

type OrderSpec = {
  project: string;
  client: string;
  venue: string;
  title: string;
  status: "borrador" | "consulta" | "opcion" | "confirmado" | "en_curso" | "devuelto" | "cancelado";
  load: Date;
  eventStart: Date;
  eventEnd: Date;
  ret: Date;
  tents: { family: string; modules: number; tweak?: (c: TentConfiguration) => void; label?: string }[];
  extras?: { item: string; qty: number }[];
  /** explicit truss reservation (acceptance scenario) */
  forceTruss?: { item: string; qty: number };
  distanceKm: number;
  color?: string;
};

let projectSeq = 0;

async function nextCounter(tx: Tx, key: string) {
  const [row] = await tx.select().from(s.counters).where(eq(s.counters.key, key));
  const v = (row?.value ?? 0) + 1;
  await tx.update(s.counters).set({ value: v }).where(eq(s.counters.key, key));
  return v;
}

async function createOrder(tx: Tx, ids: Ids, spec: OrderSpec) {
  const familyById = new Map(fixtureFamilies.map((f) => [f.id, f]));
  const dbFamily = (fid: string) => ({ ...familyById.get(fid)!, id: ids.families.get(fid)!, trussItemId: ids.items.get(familyById.get(fid)!.trussItemId!) ?? null });
  const dbItems = fixtureItems.map((i) => ({ ...i, id: ids.items.get(i.id)! }));
  const dbRules = fixtureRules.map((r) => ({ ...r, familyId: ids.families.get(r.familyId)!, itemId: ids.items.get(r.itemId)! }));
  const dbVehicles = fixtureVehicles;

  const projectStatus = spec.status === "borrador" ? "consulta" : spec.status;
  const [project] = await tx
    .insert(s.projects)
    .values({
      number: `P-2026-${String(++projectSeq).padStart(3, "0")}`,
      name: spec.project,
      clientId: ids.contacts[spec.client]!,
      venueId: ids.venues[spec.venue]!,
      status: projectStatus,
      startsAt: spec.load,
      endsAt: spec.ret,
      distanceKm: spec.distanceKm,
      managerId: "usr_demo_comercial",
      color: spec.color ?? null,
    })
    .returning();
  await nextCounter(tx, "proyecto");
  const phases: [string, Date, Date][] = [
    ["carga", spec.load, new Date(spec.load.getTime() + 2 * H)],
    ["transporte", new Date(spec.load.getTime() + 2 * H), new Date(spec.load.getTime() + 4 * H)],
    ["montaje", new Date(spec.load.getTime() + 4 * H), new Date(spec.eventStart.getTime() - 2 * H)],
    ["evento", spec.eventStart, spec.eventEnd],
    ["desmontaje", new Date(spec.eventEnd.getTime() + 2 * H), new Date(spec.ret.getTime() - 3 * H)],
    ["retorno", new Date(spec.ret.getTime() - 3 * H), spec.ret],
  ];
  for (const [kind, a, b] of phases) await tx.insert(s.projectPhases).values({ projectId: project!.id, kind, startsAt: a, endsAt: b > a ? b : new Date(a.getTime() + H) });

  const number = String(await nextCounter(tx, "pedido"));
  const [order] = await tx
    .insert(s.orders)
    .values({
      projectId: project!.id,
      number,
      title: spec.title,
      status: spec.status,
      clientId: ids.contacts[spec.client]!,
      periodStart: spec.load,
      periodEnd: spec.ret,
      eventStart: spec.eventStart,
      eventEnd: spec.eventEnd,
      optionExpiresAt: spec.status === "opcion" ? new Date(Date.now() + 5 * D) : null,
      confirmedAt: ["confirmado", "en_curso", "devuelto"].includes(spec.status) ? new Date(spec.load.getTime() - 20 * D) : null,
      confirmedBy: ["confirmado", "en_curso", "devuelto"].includes(spec.status) ? "usr_demo_comercial" : null,
    })
    .returning();

  const reserves = spec.status === "confirmado" || spec.status === "opcion" || spec.status === "consulta" || spec.status === "en_curso";
  const resStatus = spec.status === "en_curso" ? "confirmado" : spec.status;
  const pricedLines: Parameters<typeof quoteTotals>[0] = [];
  let sort = 0;
  let laborHours = 0;
  const reserveQty = new Map<string, number>();

  for (const [ti, t] of spec.tents.entries()) {
    const fam = dbFamily(t.family);
    const config = toDbConfig(defaultConfiguration(familyById.get(t.family)!, t.modules), ids.families);
    config.anchoring = spec.venue === "plaza" || spec.venue === "muro" ? "pesos" : "anclaje";
    t.tweak?.(config);
    const bom = computeBom({ config, family: fam, rules: dbRules, items: dbItems, vehicles: dbVehicles });
    laborHours += bom.labor.montajeHoras + bom.labor.desmontajeHoras;
    const composition: Composition = { version: 1, tents: [{ id: `t${ti + 1}`, label: t.label ?? fam.name, config, placement: { x: 0, y: ti * (fam.width + 2), rotation: 0 } }], gutters: [], site: null };
    const [tc] = await tx
      .insert(s.tentConfigurations)
      .values({ orderId: order!.id, label: t.label ?? `${fam.name} ${fam.width}x${t.modules * fam.moduleLength}`, composition, bom: bom.lines, metrics: { ...bom.metrics, totals: bom.totals, labor: bom.labor, vehicles: bom.vehicles }, shareToken: randomBytes(12).toString("base64url") })
      .returning();
    const itemPrices = new Map(fixtureItems.map((i) => [ids.items.get(i.id)!, { name: i.name, price: i.price, priceMode: i.priceMode as PriceMode }]));
    const ql = tentQuoteLines({ family: fam, modules: t.modules, pricing: { mode: "m2", price: fixturePricePerM2[t.family] ?? 8 }, bomLines: bom.lines, itemPrices });
    const [parent] = await tx
      .insert(s.orderLines)
      .values({ orderId: order!.id, kind: "carpa", tentConfigId: tc!.id, description: ql[0]!.description, quantity: ql[0]!.quantity, unitPrice: ql[0]!.unitPrice, priceMode: ql[0]!.priceMode, sortOrder: sort++ })
      .returning();
    pricedLines.push(ql[0]!);
    for (const sup of ql.slice(1)) {
      await tx.insert(s.orderLines).values({ orderId: order!.id, parentLineId: parent!.id, kind: "suplemento", itemId: sup.itemId, description: sup.description, quantity: sup.quantity, unitPrice: sup.unitPrice, priceMode: sup.priceMode, sortOrder: sort++ });
      pricedLines.push(sup);
    }
    for (const l of bom.lines) {
      await tx.insert(s.orderLines).values({ orderId: order!.id, parentLineId: parent!.id, kind: "articulo", itemId: l.itemId, tentConfigId: tc!.id, description: dbItems.find((i) => i.id === l.itemId)!.name, quantity: l.quantity, priceMode: "incluido", fromBom: true, sortOrder: sort++ });
      reserveQty.set(l.itemId, (reserveQty.get(l.itemId) ?? 0) + l.quantity);
    }
  }
  for (const e of spec.extras ?? []) {
    const fi = fixtureItems.find((i) => i.id === e.item)!;
    await tx.insert(s.orderLines).values({ orderId: order!.id, kind: "articulo", itemId: ids.items.get(e.item)!, description: fi.name, quantity: e.qty, unitPrice: fi.price, priceMode: fi.priceMode, sortOrder: sort++ });
    pricedLines.push({ kind: "articulo", quantity: e.qty, unitPrice: fi.price, priceMode: fi.priceMode as PriceMode, discountPct: 0 });
    reserveQty.set(ids.items.get(e.item)!, (reserveQty.get(ids.items.get(e.item)!) ?? 0) + e.qty);
  }
  if (spec.forceTruss) reserveQty.set(ids.items.get(spec.forceTruss.item)!, spec.forceTruss.qty);
  const tl = transportLine(spec.distanceKm, 1, DEFAULT_PRICING);
  await tx.insert(s.orderLines).values({ orderId: order!.id, kind: "transporte", description: tl.description, quantity: 1, unitPrice: tl.unitPrice, priceMode: "unidad", unitCost: tl.unitCost ?? 0, sortOrder: sort++ });
  pricedLines.push(tl);
  if (laborHours > 0) {
    const ll = laborLine(laborHours, DEFAULT_PRICING);
    await tx.insert(s.orderLines).values({ orderId: order!.id, kind: "mano_obra", description: ll.description, quantity: ll.quantity, unitPrice: ll.unitPrice, priceMode: "hora", unitCost: ll.unitCost ?? 0, sortOrder: sort++ });
    pricedLines.push(ll);
  }
  if (reserves) {
    for (const [itemId, qty] of reserveQty) {
      await tx.insert(s.reservations).values({ itemId, orderId: order!.id, projectId: project!.id, quantity: qty, startsAt: spec.load, endsAt: spec.ret, status: resStatus, expiresAt: order!.optionExpiresAt, source: "configuracion" });
    }
  }
  const days = Math.max(1, Math.ceil((spec.eventEnd.getTime() - spec.eventStart.getTime()) / D));
  const totals = quoteTotals(pricedLines, { days, holiday: false, settings: DEFAULT_PRICING });
  if (spec.status !== "borrador") {
    await tx.insert(s.quotes).values({
      orderId: order!.id,
      version: 1,
      number: `${number}-1`,
      status: ["confirmado", "en_curso", "devuelto"].includes(spec.status) ? "aceptado" : spec.status === "cancelado" ? "rechazado" : "enviado",
      snapshot: {
        rows: pricedLines.map((l) => ({ description: (l as { description?: string }).description ?? l.kind, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: l.priceMode, discountPct: l.discountPct, kind: l.kind, taxRate: 21 })),
        totals,
        tents: [],
        terms: "Precios sin IVA. Incluye montaje y desmontaje en horario laborable.",
        days,
        imageKey: null,
        title: spec.title,
        eventStart: spec.eventStart.toISOString(),
        eventEnd: spec.eventEnd.toISOString(),
        periodStart: spec.load.toISOString(),
        periodEnd: spec.ret.toISOString(),
      },
      total: totals.total,
      validUntil: new Date(Date.now() + 30 * D).toISOString().slice(0, 10),
      publicToken: randomBytes(16).toString("base64url"),
      sentAt: new Date(spec.load.getTime() - 25 * D),
      acceptedAt: ["confirmado", "en_curso", "devuelto"].includes(spec.status) ? new Date(spec.load.getTime() - 20 * D) : null,
      signatureName: ["confirmado", "en_curso", "devuelto"].includes(spec.status) ? "Cliente" : null,
    });
  }
  return { project: project!, order: order!, totals, laborHours };
}

async function seedProjects(tx: Tx, ids: Ids) {
  const specs: OrderSpec[] = [
    // Acceptance scenario: two confirmed projects use 30 C10B trusses on 11–14 Dec
    {
      project: "Mercado navideño de Valdecastro",
      client: "ayto",
      venue: "plaza",
      title: "Mercado navideño · Plaza Mayor",
      status: "confirmado",
      load: at(2026, 12, 10, 7),
      eventStart: at(2026, 12, 11, 10),
      eventEnd: at(2026, 12, 14, 21),
      ret: at(2026, 12, 15, 18),
      tents: [
        { family: "fam-10b", modules: 12, label: "Carpa principal 10x60" },
        { family: "fam-10b", modules: 4, label: "Carpa de servicios 10x20" },
      ],
      extras: [
        { item: "item-calefactor", qty: 6 },
        { item: "item-foco", qty: 40 },
        { item: "item-extintor", qty: 6 },
        { item: "item-certificado", qty: 1 },
      ],
      forceTruss: { item: "item-c10b", qty: 18 },
      distanceKm: 35,
      color: "#16a34a",
    },
    {
      project: "Cena de empresa Recinto Ferial",
      client: "feria",
      venue: "ferial",
      title: "Cena de Navidad · 600 comensales",
      status: "confirmado",
      load: at(2026, 12, 11, 7),
      eventStart: at(2026, 12, 12, 19),
      eventEnd: at(2026, 12, 13, 2),
      ret: at(2026, 12, 14, 18),
      tents: [{ family: "fam-10b", modules: 11, tweak: (c) => (c.interior.layout = "banquete") }],
      extras: [{ item: "item-calefactor", qty: 4 }],
      forceTruss: { item: "item-c10b", qty: 12 },
      distanceKm: 22,
      color: "#2563eb",
    },
    {
      project: "Feria del Queso de Valdecastro",
      client: "ayto",
      venue: "plaza",
      title: "Feria del Queso · carpas expositores",
      status: "consulta",
      load: at(2026, 12, 12, 7),
      eventStart: at(2026, 12, 13, 10),
      eventEnd: at(2026, 12, 13, 20),
      ret: at(2026, 12, 14, 14),
      tents: [{ family: "fam-10b", modules: 20, label: "Calle de expositores 10x100" }],
      distanceKm: 35,
    },
    {
      project: "Boda Rodríguez · Contranquil",
      client: "particular",
      venue: "covadonga",
      title: "Boda · carpa 15x30 con laterales transparentes",
      status: "opcion",
      load: at(2026, 12, 3, 7),
      eventStart: at(2026, 12, 5, 13),
      eventEnd: at(2026, 12, 6, 3),
      ret: at(2026, 12, 7, 18),
      tents: [
        {
          family: "fam-15b",
          modules: 6,
          tweak: (c) => {
            c.anchoring = "pesos";
            c.bays = c.bays.map((b, i) => ({ roof: i === 5 ? "ninguno" : "blanco", left: i < 3 ? "transparente" : "blanco", right: i < 3 ? "transparente" : "blanco" }));
            c.interior.layout = "banquete";
            c.floors.tarima = { enabled: true, excludedBays: [5] };
          },
        },
      ],
      distanceKm: 75,
      color: "#db2777",
    },
    {
      project: "Festival del Faro 2026",
      client: "festival",
      venue: "muro",
      title: "Backstage y zona VIP",
      status: "devuelto",
      load: at(2026, 11, 5, 7),
      eventStart: at(2026, 11, 6, 17),
      eventEnd: at(2026, 11, 8, 23),
      ret: at(2026, 11, 9, 18),
      tents: [{ family: "fam-15a", modules: 4 }, { family: "fam-jaima", modules: 1, label: "Jaima acreditaciones" }],
      distanceKm: 26,
    },
    {
      project: "Gala solidaria Hotel Playa Mayor",
      client: "hotel",
      venue: "finca",
      title: "Gala · carpa 20x30 alta con escenario",
      status: "en_curso",
      load: at(2026, 11, 17, 7),
      eventStart: at(2026, 11, 20, 19),
      eventEnd: at(2026, 11, 21, 2),
      ret: at(2026, 11, 23, 18),
      tents: [{ family: "fam-20a", modules: 6, tweak: (c) => ((c.interior = { layout: "teatro", stage: { enabled: true, width: 8, depth: 5, height: 0.8 } }), (c.floors.moqueta.enabled = true)) }],
      distanceKm: 100,
      color: "#9333ea",
    },
    {
      project: "Torneo de invierno Club de Golf",
      client: "club",
      venue: "golf",
      title: "Carpa 14x20 terraza",
      status: "confirmado",
      load: at(2026, 11, 26, 7),
      eventStart: at(2026, 11, 28, 9),
      eventEnd: at(2026, 11, 29, 20),
      ret: at(2026, 11, 30, 18),
      tents: [{ family: "fam-14b", modules: 4, tweak: (c) => (c.fronts.end = { type: "completo", material: "transparente" }) }],
      extras: [{ item: "item-mesa-alta", qty: 20 }],
      distanceKm: 24,
    },
    {
      project: "Feria de Muestras de Invierno",
      client: "feria",
      venue: "ferial",
      title: "Stands exteriores · 12 jaimas",
      status: "opcion",
      load: at(2027, 1, 14, 7),
      eventStart: at(2027, 1, 16, 10),
      eventEnd: at(2027, 1, 25, 20),
      ret: at(2027, 1, 27, 18),
      tents: Array.from({ length: 12 }, (_, i) => ({ family: "fam-jaima", modules: 1, label: `Jaima ${i + 1}` })),
      extras: [{ item: "item-moqueta", qty: 300 }],
      distanceKm: 22,
    },
    {
      project: "Boda Bodas con Encanto · Finca La Quintana",
      client: "bodas",
      venue: "finca",
      title: "Boda 250 invitados",
      status: "borrador",
      load: at(2026, 12, 18, 7),
      eventStart: at(2026, 12, 19, 13),
      eventEnd: at(2026, 12, 20, 3),
      ret: at(2026, 12, 21, 18),
      tents: [{ family: "fam-15a", modules: 5, tweak: (c) => (c.interior.layout = "banquete") }],
      distanceKm: 100,
    },
    {
      project: "Cabalgata de Reyes",
      client: "ayto",
      venue: "plaza",
      title: "Carpa de camerinos",
      status: "cancelado",
      load: at(2027, 1, 4, 7),
      eventStart: at(2027, 1, 5, 17),
      eventEnd: at(2027, 1, 5, 22),
      ret: at(2027, 1, 6, 14),
      tents: [{ family: "fam-7b", modules: 3 }],
      distanceKm: 35,
    },
  ];
  const created = [];
  for (const spec of specs) created.push({ spec, ...(await createOrder(tx, ids, spec)) });

  // Shifts and assignments for the confirmed / running jobs
  const jobs = created.filter((c) => ["confirmado", "en_curso", "devuelto"].includes(c.spec.status));
  for (const [ji, job] of jobs.entries()) {
    const montajeH = Math.max(4, Math.round(job.laborHours * 0.6));
    const blocks: [string, Date, number, number, string[]][] = [
      ["carga", job.spec.load, 2, 3, ["carretillero"]],
      ["montaje", new Date(job.spec.load.getTime() + 3 * H), 8, Math.min(8, Math.max(4, Math.ceil(montajeH / 8))), ["jefe_equipo", "montador"]],
      ["desmontaje", new Date(job.spec.eventEnd.getTime() + 10 * H), 8, Math.min(6, Math.max(3, Math.ceil((job.laborHours * 0.4) / 8))), ["jefe_equipo", "montador"]],
    ];
    for (const [bi, [phase, start, hours, people, skills]] of blocks.entries()) {
      const [shift] = await tx
        .insert(s.shifts)
        .values({
          projectId: job.project.id,
          orderId: job.order.id,
          phaseKind: phase,
          title: `${phase[0]!.toUpperCase()}${phase.slice(1)} · ${job.project.name}`,
          startsAt: start,
          endsAt: new Date(start.getTime() + hours * H),
          requiredPeople: people,
          requiredSkills: skills,
          estimatedHours: hours * people,
          vehicleId: phase === "carga" ? null : ids.vehicles[bi % 2]!,
          address: (await tx.select().from(s.venues).where(eq(s.venues.id, ids.venues[job.spec.venue]!)))[0]?.address ?? null,
          lat: (await tx.select().from(s.venues).where(eq(s.venues.id, ids.venues[job.spec.venue]!)))[0]?.lat ?? null,
          lng: (await tx.select().from(s.venues).where(eq(s.venues.id, ids.venues[job.spec.venue]!)))[0]?.lng ?? null,
          published: true,
          checklist: phase === "montaje" ? ["Replanteo y nivelación", "Montaje de pórticos", "Lonas de techo", "Laterales y frentes", "Lastre o anclajes revisados", "Fotos finales"] : ["Revisión de material", "Fotos"],
        })
        .returning();
      for (let k = 0; k < people; k++) {
        const w = ids.workers[(ji * 3 + bi * 2 + k) % ids.workers.length]!;
        await tx.insert(s.assignments).values({ shiftId: shift!.id, workerId: w, status: k % 3 === 0 ? "confirmado" : "asignado" }).onConflictDoNothing();
      }
      if (job.spec.status === "devuelto") {
        const assigned = await tx.select().from(s.assignments).where(eq(s.assignments.shiftId, shift!.id));
        for (const a of assigned) {
          await tx.insert(s.timeEntries).values({ workerId: a.workerId, shiftId: shift!.id, clockIn: new Date(start.getTime() + 5 * 60000), clockOut: new Date(start.getTime() + (hours + 0.5) * H), breakMinutes: 30, diet: hours >= 8, source: "app" });
        }
      }
    }
  }

  // Subrental covering the acceptance shortage alternative
  const nav = created[0]!;
  await tx.insert(s.subrentals).values({
    supplierId: ids.contacts.prov_carpas!,
    itemId: ids.items.get("item-calefactor")!,
    projectId: nav.project.id,
    orderId: nav.order.id,
    quantity: 4,
    startsAt: nav.spec.load,
    endsAt: nav.spec.ret,
    cost: 480,
    status: "confirmado",
    notes: "Calefactores adicionales para el mercado navideño",
  });
  await tx.insert(s.tasks).values([
    { projectId: nav.project.id, title: "Pedir permiso de ocupación de vía pública", dueAt: at(2026, 12, 1, 12) },
    { projectId: nav.project.id, title: "Confirmar punto de enganche eléctrico", dueAt: at(2026, 12, 5, 12), done: true },
    { projectId: created[3]!.project.id, title: "Visita técnica al prado", dueAt: at(2026, 11, 25, 10) },
  ]);
  await tx.insert(s.notes).values([
    { entity: "project", entityId: nav.project.id, body: "El ayuntamiento pide terminar el montaje antes de las 20:00 del día 10.", authorName: "Marcos Álvarez" },
    { entity: "order", entityId: created[3]!.order.id, body: "La novia quiere ver la carpa en 3D con los laterales transparentes.", authorName: "Marcos Álvarez" },
  ]);
  await tx.insert(s.tentTemplates).values([
    { name: "Boda 15x30 con transparentes", description: "Laterales transparentes en los tres primeros tramos y banquete", composition: (await tx.select().from(s.tentConfigurations).where(eq(s.tentConfigurations.orderId, created[3]!.order.id)))[0]!.composition },
    { name: "Mercado 10x60 con pesos", description: "Para plazas sin anclaje", composition: (await tx.select().from(s.tentConfigurations).where(eq(s.tentConfigurations.orderId, nav.order.id)))[0]!.composition },
  ]);
  return created;
}

async function seedFinance(tx: Tx, ids: Ids) {
  const year = 2026;
  const [series] = await tx.insert(s.invoiceSeries).values({ code: "F", name: "Facturas", kind: "normal", year, nextNumber: 1 }).returning();
  await tx.insert(s.invoiceSeries).values([
    { code: "R", name: "Rectificativas", kind: "rectificativa", year, nextNumber: 1 },
    { code: "A", name: "Anticipos", kind: "anticipo", year, nextNumber: 1 },
  ]);
  const [bank] = await tx.insert(s.bankAccounts).values({ name: "Cuenta principal", iban: "ES00 0000 0000 0000 0000 0001", openingBalance: 42500, openingDate: "2026-01-01" }).returning();
  const ordersAll = await tx.select().from(s.orders);
  const quotesAll = await tx.select().from(s.quotes);
  let n = 1;
  let prevHash: string | null = null;
  const months = [7, 8, 9, 10, 11];
  for (const [i, m] of months.entries()) {
    for (let k = 0; k < 3; k++) {
      const base = 2200 + ((i * 7 + k * 13) % 9) * 950;
      const vat = Math.round(base * 0.21 * 100) / 100;
      const issue = `${year}-${String(m).padStart(2, "0")}-${String(5 + k * 8).padStart(2, "0")}`;
      const clientKey = ["ayto", "festival", "hotel", "bodas", "feria", "club"][(i + k) % 6]!;
      const fullNumber = `F${year}-${String(n).padStart(4, "0")}`;
      // same payload as verifactuHash() in apps/web/src/server/finance/hash.ts
      const [iy, im, id] = issue.split("-");
      const hash = createHash("sha256")
        .update([`IDEmisorFactura=B33000000`, `NumSerieFactura=${fullNumber}`, `FechaExpedicionFactura=${id}-${im}-${iy}`, `TipoFactura=F1`, `ImporteTotal=${(base + vat).toFixed(2)}`, `Huella=${prevHash ?? ""}`].join("&"), "utf8")
        .digest("hex")
        .toUpperCase();
      const paid = m < 11 || k === 0;
      const [inv] = await tx
        .insert(s.invoices)
        .values({
          seriesId: series!.id,
          number: n,
          fullNumber,
          status: paid ? "cobrada" : m === 11 && k === 2 ? "vencida" : "emitida",
          clientId: ids.contacts[clientKey]!,
          issueDate: issue,
          dueDate: `${year}-${String(Math.min(12, m + 1)).padStart(2, "0")}-${String(5 + k * 8).padStart(2, "0")}`,
          lines: [{ description: "Alquiler, montaje y desmontaje de carpa", quantity: 1, unitPrice: base, taxRate: 21 }],
          subtotal: base,
          vat,
          total: base + vat,
          paid: paid ? base + vat : 0,
          recordHash: hash,
          previousHash: prevHash,
        })
        .returning();
      prevHash = hash;
      n++;
      if (paid) {
        const payDate = `${year}-${String(m).padStart(2, "0")}-${String(Math.min(28, 15 + k * 4)).padStart(2, "0")}`;
        await tx.insert(s.payments).values({ invoiceId: inv!.id, amount: base + vat, paidOn: payDate, method: "transferencia", bankAccountId: bank!.id, reference: inv!.fullNumber });
        await tx.insert(s.bankMovements).values({ accountId: bank!.id, bookedOn: payDate, concept: `Cobro ${inv!.fullNumber}`, amount: base + vat, invoiceId: inv!.id, reconciled: true, category: "cobros" });
      }
    }
  }
  await tx.update(s.invoiceSeries).set({ nextNumber: n }).where(eq(s.invoiceSeries.id, series!.id));
  // Advance invoice for the confirmed Christmas market
  const market = ordersAll.find((o) => o.title.startsWith("Mercado navideño"))!;
  const mq = quotesAll.find((q) => q.orderId === market.id)!;
  const adv = Math.round(Number(mq.total) * 0.3 * 100) / 100;
  const advBase = Math.round((adv / 1.21) * 100) / 100;
  await tx.insert(s.invoices).values({ kind: "anticipo", status: "emitida", seriesId: null, number: null, fullNumber: null, clientId: market.clientId, orderId: market.id, projectId: market.projectId, issueDate: null, lines: [{ description: `Anticipo 30 % pedido ${market.number}`, quantity: 1, unitPrice: advBase, taxRate: 21 }], subtotal: advBase, vat: Math.round((adv - advBase) * 100) / 100, total: adv });

  const purchases = [
    { supplier: "prov_lonas", concept: "Reparación de 4 laterales transparentes", base: 640, date: "2026-10-12", category: "mantenimiento", status: "pagada" },
    { supplier: "prov_carpas", concept: "Subalquiler calefactores mercado navideño", base: 480, date: "2026-11-15", category: "subalquiler", status: "pendiente" },
    { supplier: "prov_mobiliario", concept: "Sillas adicionales gala", base: 360, date: "2026-11-10", category: "subalquiler", status: "pendiente" },
    { supplier: "prov_lonas", concept: "Limpieza de lonas de techo (20 uds)", base: 900, date: "2026-09-30", category: "mantenimiento", status: "pagada" },
  ];
  for (const p of purchases) {
    const vat = Math.round(p.base * 0.21 * 100) / 100;
    const [row] = await tx
      .insert(s.purchases)
      .values({ supplierId: ids.contacts[p.supplier]!, number: `PR-${p.date.replace(/-/g, "")}`, issueDate: p.date, dueDate: p.date, concept: p.concept, category: p.category, base: p.base, vat, total: p.base + vat, status: p.status, paidOn: p.status === "pagada" ? p.date : null })
      .returning();
    if (p.status === "pagada") await tx.insert(s.bankMovements).values({ accountId: bank!.id, bookedOn: p.date, concept: `Pago ${p.concept}`, amount: -(p.base + vat), purchaseId: row!.id, reconciled: true, category: p.category });
  }
  await tx.insert(s.bankMovements).values([
    { accountId: bank!.id, bookedOn: "2026-11-01", concept: "Nóminas octubre", amount: -18400, reconciled: false, category: "personal" },
    { accountId: bank!.id, bookedOn: "2026-11-03", concept: "Gasóleo flota", amount: -1250.4, reconciled: false, category: "transporte" },
    { accountId: bank!.id, bookedOn: "2026-11-05", concept: "Seguro responsabilidad civil", amount: -2100, reconciled: false, category: "seguros" },
    { accountId: bank!.id, bookedOn: "2026-12-01", concept: "Nóminas noviembre (previsión)", amount: -18900, reconciled: false, forecast: true, category: "personal" },
  ]);
}

async function seedOps(tx: Tx, ids: Ids) {
  const it = (k: string) => ids.items.get(k)!;
  await tx.insert(s.repairs).values([
    { itemId: it("item-lat-b-trans"), quantity: 2, kind: "reparacion", status: "en_curso", reason: "Desgarro en la ventana tras temporal", cost: 160 },
    { itemId: it("item-techo-10-blanco"), quantity: 3, kind: "limpieza", status: "pendiente", reason: "Lonas con barro tras el festival" },
    { itemId: it("item-c15a"), quantity: 1, kind: "reparacion", status: "reparado", reason: "Soldadura en nudo de cumbrera", cost: 220, closedAt: new Date("2026-10-20") },
  ]);
  await tx.update(s.items).set({ stockRepair: 2 }).where(eq(s.items.id, it("item-lat-b-trans")));
  await tx.update(s.items).set({ stockRepair: 3 }).where(eq(s.items.id, it("item-techo-10-blanco")));
  await tx.insert(s.inspections).values([
    { itemId: it("item-c10b"), kind: "revision", result: "ok", inspector: "Iván Suárez", notes: "Revisión anual de cerchas de 10 m", inspectedAt: new Date("2026-02-15"), nextDueAt: new Date("2027-02-15") },
    { itemId: it("item-c15a"), kind: "revision", result: "defectos", inspector: "Iván Suárez", notes: "Una cercha con soldadura dañada → reparación", inspectedAt: new Date("2026-10-01"), nextDueAt: new Date("2026-12-01") },
    { itemId: it("item-techo-15-blanco"), kind: "revision", result: "ok", inspector: "Iván Suárez", inspectedAt: new Date("2026-05-10"), nextDueAt: new Date("2026-11-10") },
  ]);
  await tx.insert(s.emailTemplates).values([
    { key: "presupuesto", name: "Envío de presupuesto", subject: "Presupuesto {{pedido}} · {{evento}}", body: "Hola {{cliente}},\n\nTe enviamos el presupuesto para {{evento}}. Puedes verlo, ver la carpa en 3D y aceptarlo en línea aquí: {{enlace}}\n\nUn saludo,\n{{empresa}}" },
    { key: "confirmacion", name: "Confirmación de pedido", subject: "Pedido {{pedido}} confirmado", body: "Hola {{cliente}},\n\nTu pedido para {{evento}} está confirmado. Montaje previsto: {{montaje}}.\n\nGracias,\n{{empresa}}" },
    { key: "recordatorio_devolucion", name: "Recordatorio de devolución", subject: "Recogida del material · {{evento}}", body: "Hola {{cliente}},\n\nTe recordamos que la recogida del material será el {{retorno}}.\n\n{{empresa}}" },
    { key: "planning", name: "Planning semanal", subject: "Tu planning de la semana", body: "Hola {{trabajador}},\n\nYa tienes publicado tu planning de la semana en la app de Rentevent.\n\n{{empresa}}" },
  ]);
  const someOrder = (await tx.select().from(s.orders).limit(3))[1]!;
  await tx.insert(s.emails).values([
    { direction: "entrante", fromAddress: "produccion@festivaldelfaro.example", toAddress: "hola@carpasdelnorte.example", subject: "Factura del festival", body: "Hola, ¿nos podéis reenviar la factura con el CIF correcto? Gracias.", entity: "contact", entityId: ids.contacts.festival!, read: false },
    { direction: "entrante", fromAddress: "ferias@recintocantabrico.example", toAddress: "hola@carpasdelnorte.example", subject: "Plano de la cena de Navidad", body: "Adjuntamos el plano del pabellón exterior con la zona de carga.", entity: "order", entityId: someOrder.id, read: true },
    { direction: "saliente", fromAddress: "hola@carpasdelnorte.example", toAddress: "ana.rodriguez@correo.example", subject: "Presupuesto boda · carpa 15x30", body: "Hola Ana, te enviamos el presupuesto con la carpa en 3D.", entity: "contact", entityId: ids.contacts.particular!, read: true },
  ]);
  await tx.insert(s.workflows).values([
    { name: "Caducar opciones vencidas", trigger: "diario", conditions: [], action: { type: "caducar_opciones" }, active: true },
    { name: "Avisar de escasez de material", trigger: "pedido_confirmado", conditions: [], action: { type: "avisar_escasez", channel: "email", to: "almacen@rentevent.es" }, active: true },
    { name: "Recordar devolución al cliente", trigger: "diario", conditions: [{ field: "dias_para_retorno", op: "=", value: 1 }], action: { type: "enviar_plantilla", template: "recordatorio_devolucion" }, active: true },
    { name: "Enviar planning los viernes", trigger: "semanal", conditions: [], action: { type: "publicar_planning", channel: "push" }, active: false },
  ]);
  await tx.insert(s.announcements).values([
    { title: "Revisión de EPIs", body: "Antes del mercado navideño todos los arneses deben pasar revisión en la nave. Iván tiene la lista.", authorName: "Lucía Fernández", pinned: true },
    { title: "Nueva furgoneta", body: "Ya está disponible la furgoneta 9012 MPS para recogidas pequeñas.", authorName: "Iván Suárez" },
  ]);
  await tx.insert(s.notifications).values([
    { channel: "push", recipient: "Adrián García", title: "Planning publicado", body: "Tienes 3 turnos esta semana", status: "simulada" },
    { channel: "email", recipient: "ana.rodriguez@correo.example", title: "Presupuesto enviado", body: "Presupuesto de boda", status: "simulada" },
    { channel: "whatsapp", recipient: "+34 655 123 456", title: "Recordatorio visita técnica", body: "Mañana a las 10:00 en el prado", status: "simulada" },
  ]);
  await tx.insert(s.auditLog).values({ userId: "usr_demo_admin", userName: "Lucía Fernández", entity: "tenant", entityId: DEMO.tenantId, action: "crear", diff: { seed: true } });
  void randomUUID;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
  await closeDb();
}

export { main as seed };
