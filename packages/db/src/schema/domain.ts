import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/** Every tenant table carries these columns; RLS policies key on tenant_id. */
const base = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" })
    .default(sql`current_setting('app.tenant_id', true)`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
const qty = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

// ───────────────────────── Platform ─────────────────────────

export const tenantSettings = pgTable("tenant_settings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" })
    .default(sql`current_setting('app.tenant_id', true)`),
  legalName: text("legal_name").notNull().default(""),
  taxId: text("tax_id").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  province: text("province").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  country: text("country").notNull().default("ES"),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  iban: text("iban").notNull().default(""),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").notNull().default("#F95F40"),
  locale: text("locale").notNull().default("es"),
  currency: text("currency").notNull().default("EUR"),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  baseLat: doublePrecision("base_lat"),
  baseLng: doublePrecision("base_lng"),
  /** PricingSettings from @rentevent/core */
  pricing: jsonb("pricing").notNull().default({}),
  availabilityMarginMinutes: integer("availability_margin_minutes").notNull().default(60),
  optionExpiryDays: integer("option_expiry_days").notNull().default(7),
  quoteValidityDays: integer("quote_validity_days").notNull().default(30),
  quoteTerms: text("quote_terms").notNull().default(""),
  capacity: jsonb("capacity").notNull().default({ coctelM2: 0.8, banqueteM2: 1.4, teatroM2: 0.9 }),
  fieldPermissions: jsonb("field_permissions").notNull().default({}),
  plan: text("plan").notNull().default("trial"),
  planSeats: integer("plan_seats").notNull().default(5),
  modules: text("modules").array().notNull().default(sql`'{}'::text[]`),
  trialEndsAt: ts("trial_ends_at"),
  subscriptionStatus: text("subscription_status").notNull().default("trialing"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
  manufacturerWizardDone: boolean("manufacturer_wizard_done").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const counters = pgTable(
  "counters",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
      .default(sql`current_setting('app.tenant_id', true)`),
    key: text("key").notNull(),
    value: integer("value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);

export const auditLog = pgTable(
  "audit_log",
  {
    ...base(),
    userId: text("user_id"),
    userName: text("user_name"),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    diff: jsonb("diff"),
  },
  (t) => [index("audit_entity_idx").on(t.tenantId, t.entity, t.entityId), index("audit_created_idx").on(t.tenantId, t.createdAt)],
);

export const apiKeys = pgTable("api_keys", {
  ...base(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull().unique(),
  scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
  lastUsedAt: ts("last_used_at"),
  createdBy: text("created_by"),
  revokedAt: ts("revoked_at"),
});

export const webhooks = pgTable("webhooks", {
  ...base(),
  url: text("url").notNull(),
  events: text("events").array().notNull(),
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  ...base(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  status: integer("status"),
  attempts: integer("attempts").notNull().default(0),
  deliveredAt: ts("delivered_at"),
  error: text("error"),
});

export const savedViews = pgTable("saved_views", {
  ...base(),
  userId: text("user_id").notNull(),
  entity: text("entity").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").notNull(),
});

/** Durable job queue used when no Redis is configured. */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id"),
    name: text("name").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAt: ts("run_at").notNull().defaultNow(),
    lockedAt: ts("locked_at"),
    lastError: text("last_error"),
    result: jsonb("result"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("jobs_pending_idx").on(t.status, t.runAt)],
);

export const files = pgTable(
  "files",
  {
    ...base(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: text("uploaded_by"),
  },
  (t) => [index("files_entity_idx").on(t.tenantId, t.entity, t.entityId)],
);

export const notes = pgTable(
  "notes",
  {
    ...base(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    body: text("body").notNull(),
    authorId: text("author_id"),
    authorName: text("author_name"),
    internal: boolean("internal").notNull().default(true),
  },
  (t) => [index("notes_entity_idx").on(t.tenantId, t.entity, t.entityId)],
);

// ───────────────────────── Contacts & venues ─────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    ...base(),
    kind: text("kind").notNull().default("cliente"),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    taxId: text("tax_id"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    discountPct: money("discount_pct").notNull().default(0),
    paymentTermsDays: integer("payment_terms_days").notNull().default(30),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => [index("contacts_name_idx").on(t.tenantId, t.name)],
);

export const contactAddresses = pgTable("contact_addresses", {
  ...base(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Principal"),
  line1: text("line1").notNull(),
  city: text("city").notNull().default(""),
  province: text("province").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  country: text("country").notNull().default("ES"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  isDefault: boolean("is_default").notNull().default(false),
});

export const contactPersons = pgTable("contact_persons", {
  ...base(),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: text("position"),
  email: text("email"),
  phone: text("phone"),
});

export const venues = pgTable("venues", {
  ...base(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  groundType: text("ground_type").notNull().default("cesped"),
  anchoringAllowed: boolean("anchoring_allowed").notNull().default(true),
  accessNotes: text("access_notes"),
  restrictions: text("restrictions"),
  maxVehicle: text("max_vehicle"),
  planFileId: uuid("plan_file_id"),
  planImageUrl: text("plan_image_url"),
  metresPerPixel: doublePrecision("metres_per_pixel"),
});

// ───────────────────────── Inventory ─────────────────────────

export const warehouses = pgTable("warehouses", {
  ...base(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
});

export const items = pgTable(
  "items",
  {
    ...base(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("General"),
    kind: text("kind").notNull().default("granel"),
    unit: text("unit").notNull().default("ud"),
    role: text("role").notNull().default("otro"),
    roleAmount: doublePrecision("role_amount").notNull().default(1),
    weightKg: doublePrecision("weight_kg").notNull().default(0),
    volumeM3: doublePrecision("volume_m3").notNull().default(0),
    lengthM: doublePrecision("length_m"),
    widthM: doublePrecision("width_m"),
    heightM: doublePrecision("height_m"),
    price: money("price").notNull().default(0),
    priceMode: text("price_mode").notNull().default("unidad"),
    costPrice: money("cost_price").notNull().default(0),
    replacementCost: money("replacement_cost").notNull().default(0),
    stockTotal: qty("stock_total").notNull().default(0),
    stockRepair: qty("stock_repair").notNull().default(0),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    location: text("location"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    pendingValidation: boolean("pending_validation").notNull().default(false),
    inspectionIntervalDays: integer("inspection_interval_days"),
    /** null | "caja" (flight case / transport box) | "conjunto" (fixed set, e.g. mic + receiver + batteries) */
    container: text("container"),
  },
  (t) => [uniqueIndex("items_sku_idx").on(t.tenantId, t.sku)],
);

export const itemUnits = pgTable(
  "item_units",
  {
    ...base(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    serial: text("serial").notNull(),
    qrCode: text("qr_code").notNull(),
    status: text("status").notNull().default("disponible"),
    purchasedAt: date("purchased_at"),
    lastInspectionAt: ts("last_inspection_at"),
    notes: text("notes"),
    /** where it sits when in the warehouse (falls back to the item's location) */
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    location: text("location"),
    /** case or set this unit is packed in */
    parentUnitId: uuid("parent_unit_id").references((): AnyPgColumn => itemUnits.id, { onDelete: "set null" }),
    /** order it is out on (status en_obra) */
    currentOrderId: uuid("current_order_id").references((): AnyPgColumn => orders.id, { onDelete: "set null" }),
    lastSeenAt: ts("last_seen_at"),
  },
  (t) => [uniqueIndex("item_units_qr_idx").on(t.tenantId, t.qrCode), index("item_units_parent_idx").on(t.tenantId, t.parentUnitId), index("item_units_order_idx").on(t.tenantId, t.currentOrderId)],
);

/** Bulk (non-serialised) contents of a case or set, e.g. 2 AA batteries, 4 XLR cables. */
export const unitContents = pgTable(
  "unit_contents",
  {
    ...base(),
    containerUnitId: uuid("container_unit_id")
      .notNull()
      .references(() => itemUnits.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    quantity: qty("quantity").notNull(),
  },
  (t) => [uniqueIndex("unit_contents_idx").on(t.tenantId, t.containerUnitId, t.itemId)],
);

/** Per-unit history: what happened to one serial number, when and where. */
export const unitEvents = pgTable(
  "unit_events",
  {
    ...base(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => itemUnits.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    orderId: uuid("order_id").references((): AnyPgColumn => orders.id, { onDelete: "set null" }),
    note: text("note"),
    userId: text("user_id"),
    userName: text("user_name"),
  },
  (t) => [index("unit_events_unit_idx").on(t.tenantId, t.unitId, t.createdAt)],
);

export const kits = pgTable("kits", {
  ...base(),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  price: money("price").notNull().default(0),
  description: text("description"),
});

export const kitItems = pgTable("kit_items", {
  ...base(),
  kitId: uuid("kit_id")
    .notNull()
    .references(() => kits.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  quantity: qty("quantity").notNull(),
});

// ───────────────────────── Tents ─────────────────────────

export const structureFamilies = pgTable(
  "structure_families",
  {
    ...base(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    width: doublePrecision("width").notNull(),
    moduleLength: doublePrecision("module_length").notNull().default(5),
    eaveHeight: doublePrecision("eave_height").notNull(),
    ridgeHeight: doublePrecision("ridge_height").notNull(),
    heightClass: text("height_class").notNull().default("baja"),
    roofShape: text("roof_shape").notNull().default("dos_aguas"),
    trussItemId: uuid("truss_item_id").references(() => items.id, { onDelete: "set null" }),
    minModules: integer("min_modules").notNull().default(1),
    maxModules: integer("max_modules").notNull().default(20),
    parameters: jsonb("parameters").$type<Record<string, number>>().notNull().default({}),
    labor: jsonb("labor").notNull().default({}),
    priceMode: text("price_mode").notNull().default("m2"),
    price: money("price").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    parametersPending: boolean("parameters_pending").notNull().default(true),
  },
  (t) => [uniqueIndex("families_code_idx").on(t.tenantId, t.code)],
);

export const bomRules = pgTable(
  "bom_rules",
  {
    ...base(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => structureFamilies.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    formula: text("formula").notNull(),
    condition: text("condition"),
    group: text("group").notNull().default("estructura"),
    sortOrder: integer("sort_order").notNull().default(0),
    note: text("note"),
  },
  (t) => [index("bom_rules_family_idx").on(t.tenantId, t.familyId)],
);

export const tentTemplates = pgTable("tent_templates", {
  ...base(),
  name: text("name").notNull(),
  description: text("description"),
  composition: jsonb("composition").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
});

// ───────────────────────── Projects & orders ─────────────────────────

export const PROJECT_STATUSES = ["consulta", "opcion", "confirmado", "en_curso", "devuelto", "cancelado"] as const;

export const projects = pgTable(
  "projects",
  {
    ...base(),
    number: text("number").notNull(),
    name: text("name").notNull(),
    clientId: uuid("client_id").references(() => contacts.id, { onDelete: "set null" }),
    venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
    locationAddress: text("location_address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    distanceKm: doublePrecision("distance_km"),
    status: text("status").notNull().default("consulta"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    managerId: text("manager_id"),
    color: text("color"),
    description: text("description"),
    recurringOfId: uuid("recurring_of_id"),
  },
  (t) => [uniqueIndex("projects_number_idx").on(t.tenantId, t.number), index("projects_dates_idx").on(t.tenantId, t.startsAt)],
);

export const projectPhases = pgTable("project_phases", {
  ...base(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  notes: text("notes"),
});

export const tasks = pgTable("tasks", {
  ...base(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  dueAt: ts("due_at"),
  assigneeId: text("assignee_id"),
});

export const ORDER_STATUSES = ["borrador", "consulta", "opcion", "confirmado", "en_curso", "devuelto", "cancelado"] as const;

/** "Pedido": a quote / rental order inside a project (the subproject). */
export const orders = pgTable(
  "orders",
  {
    ...base(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("borrador"),
    clientId: uuid("client_id").references(() => contacts.id, { onDelete: "set null" }),
    /** material blocked from load to return */
    periodStart: ts("period_start").notNull(),
    periodEnd: ts("period_end").notNull(),
    eventStart: ts("event_start"),
    eventEnd: ts("event_end"),
    optionExpiresAt: ts("option_expires_at"),
    discountPct: money("discount_pct").notNull().default(0),
    holiday: boolean("holiday").notNull().default(false),
    trips: integer("trips").notNull().default(1),
    notes: text("notes"),
    confirmedAt: ts("confirmed_at"),
    confirmedBy: text("confirmed_by"),
  },
  (t) => [uniqueIndex("orders_number_idx").on(t.tenantId, t.number), index("orders_period_idx").on(t.tenantId, t.periodStart)],
);

export const tentConfigurations = pgTable("tent_configurations", {
  ...base(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Carpa"),
  /** validated Composition JSON — single source of truth for BOM, 3D and price */
  composition: jsonb("composition").notNull(),
  bom: jsonb("bom").notNull().default([]),
  metrics: jsonb("metrics").notNull().default({}),
  imageKey: text("image_key"),
  shareToken: text("share_token").unique(),
});

export const orderLines = pgTable(
  "order_lines",
  {
    ...base(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    parentLineId: uuid("parent_line_id"),
    kind: text("kind").notNull(),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    kitId: uuid("kit_id").references(() => kits.id, { onDelete: "set null" }),
    tentConfigId: uuid("tent_config_id").references(() => tentConfigurations.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: qty("quantity").notNull().default(1),
    unitPrice: money("unit_price").notNull().default(0),
    priceMode: text("price_mode").notNull().default("unidad"),
    discountPct: money("discount_pct").notNull().default(0),
    unitCost: money("unit_cost").notNull().default(0),
    taxRate: money("tax_rate").notNull().default(21),
    sortOrder: integer("sort_order").notNull().default(0),
    /** sub-lines generated from a tent BOM are not priced individually */
    fromBom: boolean("from_bom").notNull().default(false),
  },
  (t) => [index("order_lines_order_idx").on(t.tenantId, t.orderId)],
);

export const reservations = pgTable(
  "reservations",
  {
    ...base(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    lineId: uuid("line_id"),
    quantity: qty("quantity").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    status: text("status").notNull(),
    expiresAt: ts("expires_at"),
    source: text("source").notNull().default("manual"),
  },
  (t) => [index("reservations_item_period_idx").on(t.tenantId, t.itemId, t.startsAt, t.endsAt)],
);

export const quotes = pgTable(
  "quotes",
  {
    ...base(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    number: text("number").notNull(),
    status: text("status").notNull().default("borrador"),
    snapshot: jsonb("snapshot").notNull(),
    total: money("total").notNull().default(0),
    validUntil: date("valid_until"),
    publicToken: text("public_token").notNull().unique(),
    sentAt: ts("sent_at"),
    viewedAt: ts("viewed_at"),
    acceptedAt: ts("accepted_at"),
    rejectedAt: ts("rejected_at"),
    signatureName: text("signature_name"),
    signatureImage: text("signature_image"),
    signatureIp: text("signature_ip"),
  },
  (t) => [uniqueIndex("quotes_order_version_idx").on(t.orderId, t.version)],
);

export const subrentals = pgTable("subrentals", {
  ...base(),
  supplierId: uuid("supplier_id").references(() => contacts.id, { onDelete: "set null" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  quantity: qty("quantity").notNull(),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  cost: money("cost").notNull().default(0),
  status: text("status").notNull().default("solicitado"),
  receivedQuantity: qty("received_quantity").notNull().default(0),
  receivedAt: ts("received_at"),
  returnedAt: ts("returned_at"),
  notes: text("notes"),
});

// ───────────────────────── Finance ─────────────────────────

export const invoiceSeries = pgTable(
  "invoice_series",
  {
    ...base(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("normal"),
    nextNumber: integer("next_number").notNull().default(1),
    year: integer("year").notNull(),
  },
  (t) => [uniqueIndex("invoice_series_code_idx").on(t.tenantId, t.code, t.year)],
);

export const invoices = pgTable(
  "invoices",
  {
    ...base(),
    seriesId: uuid("series_id").references(() => invoiceSeries.id, { onDelete: "restrict" }),
    number: integer("number"),
    fullNumber: text("full_number"),
    kind: text("kind").notNull().default("normal"),
    status: text("status").notNull().default("borrador"),
    clientId: uuid("client_id").references(() => contacts.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    rectifiesId: uuid("rectifies_id"),
    rectificationReason: text("rectification_reason"),
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    clientSnapshot: jsonb("client_snapshot"),
    lines: jsonb("lines").notNull().default([]),
    subtotal: money("subtotal").notNull().default(0),
    vat: money("vat").notNull().default(0),
    total: money("total").notNull().default(0),
    paid: money("paid").notNull().default(0),
    notes: text("notes"),
    /** Verifactu-ready chain: hash of this record and the previous one */
    recordHash: text("record_hash"),
    previousHash: text("previous_hash"),
    verifactuStatus: text("verifactu_status").notNull().default("no_enviada"),
    einvoiceStatus: text("einvoice_status").notNull().default("no_enviada"),
  },
  (t) => [index("invoices_issue_idx").on(t.tenantId, t.issueDate)],
);

export const bankAccounts = pgTable("bank_accounts", {
  ...base(),
  name: text("name").notNull(),
  iban: text("iban").notNull().default(""),
  openingBalance: money("opening_balance").notNull().default(0),
  openingDate: date("opening_date"),
});

export const payments = pgTable("payments", {
  ...base(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amount: money("amount").notNull(),
  paidOn: date("paid_on").notNull(),
  method: text("method").notNull().default("transferencia"),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
  reference: text("reference"),
});

export const purchases = pgTable("purchases", {
  ...base(),
  kind: text("kind").notNull().default("factura"),
  supplierId: uuid("supplier_id").references(() => contacts.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  subrentalId: uuid("subrental_id").references(() => subrentals.id, { onDelete: "set null" }),
  number: text("number"),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date"),
  concept: text("concept").notNull(),
  category: text("category").notNull().default("general"),
  base: money("base").notNull().default(0),
  vat: money("vat").notNull().default(0),
  total: money("total").notNull().default(0),
  status: text("status").notNull().default("pendiente"),
  paidOn: date("paid_on"),
});

export const bankMovements = pgTable("bank_movements", {
  ...base(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => bankAccounts.id, { onDelete: "cascade" }),
  bookedOn: date("booked_on").notNull(),
  concept: text("concept").notNull(),
  amount: money("amount").notNull(),
  category: text("category"),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  purchaseId: uuid("purchase_id").references(() => purchases.id, { onDelete: "set null" }),
  reconciled: boolean("reconciled").notNull().default(false),
  forecast: boolean("forecast").notNull().default(false),
});

// ───────────────────────── Crew & transport ─────────────────────────

export const workers = pgTable("workers", {
  ...base(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  type: text("type").notNull().default("plantilla"),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  trainingExpiresAt: date("training_expires_at"),
  costPerHour: money("cost_per_hour").notNull().default(18),
  weeklyHoursLimit: integer("weekly_hours_limit").notNull().default(40),
  address: text("address"),
  homeLat: doublePrecision("home_lat"),
  homeLng: doublePrecision("home_lng"),
  color: text("color"),
  active: boolean("active").notNull().default(true),
});

export const workerUnavailability = pgTable("worker_unavailability", {
  ...base(),
  workerId: uuid("worker_id")
    .notNull()
    .references(() => workers.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("vacaciones"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  note: text("note"),
});

export const vehicles = pgTable("vehicles", {
  ...base(),
  name: text("name").notNull(),
  plate: text("plate").notNull().default(""),
  kind: text("kind").notNull().default("camion"),
  maxPayloadKg: doublePrecision("max_payload_kg").notNull(),
  volumeM3: doublePrecision("volume_m3").notNull(),
  licenceRequired: text("licence_required").notNull().default("conductor_c"),
  itvUntil: date("itv_until"),
  costPerKm: money("cost_per_km").notNull().default(0.9),
  active: boolean("active").notNull().default(true),
});

export const shifts = pgTable(
  "shifts",
  {
    ...base(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    phaseKind: text("phase_kind").notNull(),
    title: text("title").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    requiredPeople: integer("required_people").notNull().default(1),
    requiredSkills: text("required_skills").array().notNull().default(sql`'{}'::text[]`),
    estimatedHours: doublePrecision("estimated_hours"),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    notes: text("notes"),
    published: boolean("published").notNull().default(false),
    checklist: jsonb("checklist").notNull().default([]),
  },
  (t) => [index("shifts_period_idx").on(t.tenantId, t.startsAt)],
);

export const assignments = pgTable(
  "assignments",
  {
    ...base(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("asignado"),
    role: text("role"),
    overrideReason: text("override_reason"),
  },
  (t) => [uniqueIndex("assignments_shift_worker_idx").on(t.shiftId, t.workerId)],
);

export const timeEntries = pgTable("time_entries", {
  ...base(),
  workerId: uuid("worker_id")
    .notNull()
    .references(() => workers.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  clockIn: ts("clock_in").notNull(),
  clockOut: ts("clock_out"),
  latIn: doublePrecision("lat_in"),
  lngIn: doublePrecision("lng_in"),
  latOut: doublePrecision("lat_out"),
  lngOut: doublePrecision("lng_out"),
  breakMinutes: integer("break_minutes").notNull().default(0),
  diet: boolean("diet").notNull().default(false),
  source: text("source").notNull().default("app"),
  notes: text("notes"),
  /** edits after the fact are logged for labour inspection */
  editedBy: text("edited_by"),
  editReason: text("edit_reason"),
});

export const jobReports = pgTable("job_reports", {
  ...base(),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  workerId: uuid("worker_id").references(() => workers.id, { onDelete: "set null" }),
  checklist: jsonb("checklist").notNull().default([]),
  photos: jsonb("photos").notNull().default([]),
  incidents: text("incidents"),
  clientName: text("client_name"),
  clientSignature: text("client_signature"),
  completedAt: ts("completed_at"),
  clientRef: text("client_ref").unique(),
});

// ───────────────────────── Warehouse & maintenance ─────────────────────────

export const pickLists = pgTable("pick_lists", {
  ...base(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("salida"),
  status: text("status").notNull().default("por_preparar"),
  dueAt: ts("due_at"),
  /** ids of cases/sets scanned as a whole on this list */
  scannedContainers: text("scanned_containers").array().notNull().default(sql`'{}'::text[]`),
});

export const pickListLines = pgTable("pick_list_lines", {
  ...base(),
  pickListId: uuid("pick_list_id")
    .notNull()
    .references(() => pickLists.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  location: text("location"),
  quantity: qty("quantity").notNull(),
  prepared: qty("prepared").notNull().default(0),
  loaded: qty("loaded").notNull().default(0),
  returned: qty("returned").notNull().default(0),
  damaged: qty("damaged").notNull().default(0),
  lost: qty("lost").notNull().default(0),
  status: text("status").notNull().default("por_preparar"),
  scannedUnits: text("scanned_units").array().notNull().default(sql`'{}'::text[]`),
});

export const movements = pgTable(
  "movements",
  {
    ...base(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").references(() => itemUnits.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    kind: text("kind").notNull(),
    quantity: qty("quantity").notNull(),
    userId: text("user_id"),
    note: text("note"),
  },
  (t) => [index("movements_item_idx").on(t.tenantId, t.itemId)],
);

export const repairs = pgTable("repairs", {
  ...base(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").references(() => itemUnits.id, { onDelete: "set null" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("reparacion"),
  quantity: qty("quantity").notNull().default(1),
  status: text("status").notNull().default("pendiente"),
  reason: text("reason").notNull(),
  cost: money("cost").notNull().default(0),
  closedAt: ts("closed_at"),
  resolution: text("resolution"),
});

export const inspections = pgTable("inspections", {
  ...base(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  unitId: uuid("unit_id").references(() => itemUnits.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("revision"),
  result: text("result").notNull().default("ok"),
  inspector: text("inspector"),
  notes: text("notes"),
  inspectedAt: ts("inspected_at").notNull(),
  nextDueAt: ts("next_due_at"),
});

export const stockCounts = pgTable("stock_counts", {
  ...base(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  expected: qty("expected").notNull(),
  counted: qty("counted").notNull(),
  countedBy: text("counted_by"),
  applied: boolean("applied").notNull().default(false),
});

export const deliveryNotes = pgTable("delivery_notes", {
  ...base(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("entrega"),
  number: text("number").notNull(),
  lines: jsonb("lines").notNull().default([]),
  signedName: text("signed_name"),
  signature: text("signature"),
  signedAt: ts("signed_at"),
});

// ───────────────────────── Communication & automation ─────────────────────────

export const emailTemplates = pgTable("email_templates", {
  ...base(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
});

export const emails = pgTable(
  "emails",
  {
    ...base(),
    direction: text("direction").notNull().default("saliente"),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    threadId: text("thread_id"),
    read: boolean("read").notNull().default(false),
    status: text("status").notNull().default("enviado"),
  },
  (t) => [index("emails_entity_idx").on(t.tenantId, t.entity, t.entityId)],
);

export const notifications = pgTable("notifications", {
  ...base(),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  userId: text("user_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  status: text("status").notNull().default("enviada"),
  readAt: ts("read_at"),
});

export const announcements = pgTable("announcements", {
  ...base(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  authorName: text("author_name"),
  pinned: boolean("pinned").notNull().default(false),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  ...base(),
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").notNull(),
});

export const workflows = pgTable("workflows", {
  ...base(),
  name: text("name").notNull(),
  trigger: text("trigger").notNull(),
  conditions: jsonb("conditions").notNull().default([]),
  action: jsonb("action").notNull(),
  active: boolean("active").notNull().default(true),
  lastRunAt: ts("last_run_at"),
});

export const workflowRuns = pgTable("workflow_runs", {
  ...base(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflows.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  detail: text("detail"),
  entity: text("entity"),
  entityId: text("entity_id"),
});

export const aiMessages = pgTable("ai_messages", {
  ...base(),
  userId: text("user_id").notNull(),
  conversationId: uuid("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  data: jsonb("data"),
});

// ───────────────────────── System (no tenant RLS policy: app role denied) ─────────────────────────

/** Simulated mail transport: messages land here when no SMTP is configured. */
export const outboxEmails = pgTable("outbox_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Simulated object storage (S3 adapter fallback). Keys are prefixed with the tenant id. */
export const blobs = pgTable("blobs", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
