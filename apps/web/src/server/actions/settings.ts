"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, apiKeys, contacts, contactAddresses, contactPersons, eq, invoices, isNull, organization, structureFamilies, systemDb, tenantSettings, webhooks } from "@rentevent/db";
import { DEFAULT_PRICING } from "@rentevent/core";
import { geocode } from "@/lib/adapters/maps";
import { createCheckout, createPortal } from "@/lib/adapters/payments";
import { generateApiKey } from "../api/keys";
import { deliverToHook, retryDelivery, WEBHOOK_EVENTS } from "../api/webhooks";
import { audit } from "../audit";
import { tenantAction, UserError } from "../action";
import { ACTIVE_TENANT_COOKIE } from "../context";
import { installExampleCatalogue } from "../settings/catalog-template";
import type { PlanId } from "../billing/plans";

const companyInput = z.object({
  name: z.string().trim().min(2).max(80),
  legalName: z.string().trim().max(160),
  taxId: z.string().trim().max(20),
  address: z.string().trim().max(200),
  city: z.string().trim().max(80),
  province: z.string().trim().max(80),
  postalCode: z.string().trim().max(10),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(160),
  website: z.string().trim().max(160),
  iban: z.string().trim().max(40),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal, p. ej. #F95F40"),
  availabilityMarginMinutes: z.coerce.number().int().min(0).max(2880),
  optionExpiryDays: z.coerce.number().int().min(1).max(90),
  quoteValidityDays: z.coerce.number().int().min(1).max(365),
  quoteTerms: z.string().max(6000),
});

export const saveCompany = tenantAction(companyInput, "configuracion", async (input, tx, ctx) => {
  const { name, ...rest } = input;
  const [before] = await tx.select().from(tenantSettings);
  let geo: { baseLat?: number; baseLng?: number } = {};
  const addr = [input.address, input.postalCode, input.city, input.province].filter(Boolean).join(", ");
  if (addr && (addr !== [before?.address, before?.postalCode, before?.city, before?.province].filter(Boolean).join(", ") || before?.baseLat == null)) {
    const g = await geocode(addr);
    if (g) geo = { baseLat: g.lat, baseLng: g.lng };
  }
  if (before) await tx.update(tenantSettings).set({ ...rest, ...geo, updatedAt: new Date() });
  else await tx.insert(tenantSettings).values({ ...rest, ...geo });
  await systemDb().update(organization).set({ name }).where(eq(organization.id, ctx.tenantId));
  await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { empresa: true });
  revalidatePath("/app", "layout");
  return { geocoded: Boolean(geo.baseLat) };
});

const tier = z.object({ days: z.coerce.number().int().min(1).max(365), factor: z.coerce.number().min(0).max(100) });
const pricingInput = z.object({
  vatRate: z.coerce.number().min(0).max(30),
  durationTiers: z.array(tier).min(1).max(20),
  extraDayFactor: z.coerce.number().min(0).max(10),
  tentIncludedDays: z.coerce.number().int().min(1).max(60),
  tentExtraDayPct: z.coerce.number().min(0).max(100),
  holidaySurchargePct: z.coerce.number().min(0).max(200),
  transportPerKm: z.coerce.number().min(0).max(50),
  transportMinimum: z.coerce.number().min(0).max(10000),
  transportCostPerKm: z.coerce.number().min(0).max(50),
  laborPricePerHour: z.coerce.number().min(0).max(500),
  laborCostPerHour: z.coerce.number().min(0).max(500),
  families: z.array(z.object({ id: z.string().uuid(), price: z.coerce.number().min(0).max(10000), priceMode: z.enum(["m2", "ml"]) })).max(200),
});

export const savePricing = tenantAction(pricingInput, "configuracion", async (input, tx, ctx) => {
  const { families, ...pricing } = input;
  const days = pricing.durationTiers.map((t) => t.days);
  if (new Set(days).size !== days.length) throw new UserError("Hay tramos de duración repetidos.");
  pricing.durationTiers.sort((a, b) => a.days - b.days);
  await tx.update(tenantSettings).set({ pricing: { ...DEFAULT_PRICING, ...pricing } });
  for (const f of families) await tx.update(structureFamilies).set({ price: f.price, priceMode: f.priceMode }).where(eq(structureFamilies.id, f.id));
  await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { tarifas: true });
  revalidatePath("/app/configuracion/tarifas");
  return { ok: true };
});

export const saveFieldPermissions = tenantAction(
  z.object({ permissions: z.record(z.string(), z.record(z.enum(["margen", "coste", "coste_hora"]), z.boolean())) }),
  "usuarios",
  async ({ permissions }, tx, ctx) => {
    await tx.update(tenantSettings).set({ fieldPermissions: permissions });
    await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { permisosCampo: true });
    revalidatePath("/app/configuracion/usuarios");
    return { ok: true };
  },
);

export const saveQuoteTerms = tenantAction(z.object({ quoteTerms: z.string().max(6000), quoteValidityDays: z.coerce.number().int().min(1).max(365) }), "configuracion", async (input, tx, ctx) => {
  await tx.update(tenantSettings).set(input);
  await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { condiciones: true });
  revalidatePath("/app/configuracion/plantillas");
  return { ok: true };
});

// ── API keys & webhooks
export const createApiKey = tenantAction(z.object({ name: z.string().trim().min(2).max(60) }), "configuracion", async ({ name }, tx, ctx) => {
  const k = generateApiKey();
  const [row] = await tx.insert(apiKeys).values({ name, prefix: k.prefix, hash: k.hash, scopes: ["*"], createdBy: ctx.user.name }).returning({ id: apiKeys.id });
  await audit(tx, ctx, "api_key", row!.id, "crear", { nombre: name, prefijo: k.prefix });
  revalidatePath("/app/configuracion/api");
  return { id: row!.id, secret: k.secret };
});

export const revokeApiKey = tenantAction(z.object({ id: z.string().uuid() }), "configuracion", async ({ id }, tx, ctx) => {
  await tx.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
  await audit(tx, ctx, "api_key", id, "borrar");
  revalidatePath("/app/configuracion/api");
  return { id };
});

export const saveWebhook = tenantAction(
  z.object({ id: z.string().uuid().nullable(), url: z.string().url("URL no válida").refine((u) => u.startsWith("https://") || process.env.NODE_ENV !== "production", "Debe ser https"), events: z.array(z.enum([...WEBHOOK_EVENTS, "*"])).min(1, "Elige al menos un evento"), active: z.boolean() }),
  "configuracion",
  async (input, tx, ctx) => {
    if (input.id) {
      await tx.update(webhooks).set({ url: input.url, events: input.events, active: input.active }).where(eq(webhooks.id, input.id));
      await audit(tx, ctx, "webhook", input.id, "editar");
      revalidatePath("/app/configuracion/api");
      return { id: input.id, secret: null as string | null };
    }
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;
    const [row] = await tx.insert(webhooks).values({ url: input.url, events: input.events, active: input.active, secret }).returning({ id: webhooks.id });
    await audit(tx, ctx, "webhook", row!.id, "crear", { url: input.url });
    revalidatePath("/app/configuracion/api");
    return { id: row!.id, secret };
  },
);

export const deleteWebhook = tenantAction(z.object({ id: z.string().uuid() }), "configuracion", async ({ id }, tx, ctx) => {
  await tx.delete(webhooks).where(eq(webhooks.id, id));
  await audit(tx, ctx, "webhook", id, "borrar");
  revalidatePath("/app/configuracion/api");
  return { id };
});

export const testWebhook = tenantAction(z.object({ id: z.string().uuid() }), "configuracion", async ({ id }, tx) => {
  const [h] = await tx.select().from(webhooks).where(eq(webhooks.id, id));
  if (!h) throw new UserError("Webhook no encontrado");
  const ok = await deliverToHook(tx, h, "ping", { message: "Prueba de Rentevent", webhook_id: id });
  revalidatePath("/app/configuracion/api");
  return { ok };
});

export const retryWebhookDelivery = tenantAction(z.object({ id: z.string().uuid() }), "configuracion", async ({ id }, tx) => {
  const r = await retryDelivery(tx, id);
  if (!r) throw new UserError("Entrega no encontrada");
  revalidatePath("/app/configuracion/api");
  return { ok: r.status != null && r.status < 300 };
});

// ── Subscription
export const choosePlan = tenantAction(z.object({ plan: z.enum(["basico", "profesional", "empresa"]), seats: z.coerce.number().int().min(1).max(500), annual: z.boolean() }), "configuracion", async (input, tx, ctx) => {
  if (input.plan === "empresa") throw new UserError("El plan Empresa se contrata con nuestro equipo: escríbenos desde /contacto.");
  const [s] = await tx.select().from(tenantSettings);
  const r = await createCheckout({ tenantId: ctx.tenantId, slug: ctx.slug, email: ctx.user.email, plan: input.plan as PlanId, seats: input.seats, annual: input.annual, customerId: s?.stripeCustomerId ?? null });
  await audit(tx, ctx, "subscription", ctx.tenantId, "editar", { checkout: input.plan, modo: r.mode });
  return r;
});

export const openBillingPortal = tenantAction(z.object({}), "configuracion", async (_i, tx) => {
  const [s] = await tx.select().from(tenantSettings);
  const url = await createPortal(s?.stripeCustomerId ?? null);
  return { url };
});

// ── Onboarding
export const saveOnboardingStep = tenantAction(z.object({ step: z.number().int().min(0).max(6), done: z.boolean().default(false) }), "configuracion", async ({ step, done }, tx, ctx) => {
  await tx.update(tenantSettings).set({ onboardingStep: step, ...(done ? { onboardingDone: true } : {}) });
  if (done) await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { onboarding: "completado" });
  revalidatePath("/app", "layout");
  return { step };
});

export const installCatalogue = tenantAction(z.object({ widths: z.array(z.number()).max(10), includeJaima: z.boolean(), keepStock: z.boolean() }), "configuracion", async (input, tx, ctx) => {
  const existing = await tx.select({ id: structureFamilies.id }).from(structureFamilies).limit(1);
  if (existing.length) throw new UserError("Ya tienes familias de carpa: gestiónalas en Carpas.");
  const r = await installExampleCatalogue(tx, input);
  await audit(tx, ctx, "tenant", ctx.tenantId, "importar", { catalogoEjemplo: r });
  revalidatePath("/app/carpas");
  return r;
});

// ── RGPD
export const deleteCompany = tenantAction(z.object({ confirmSlug: z.string() }), "configuracion", async ({ confirmSlug }, _tx, ctx) => {
  if (ctx.role !== "administrador") throw new UserError("Solo un administrador puede eliminar la empresa.");
  if (confirmSlug.trim() !== ctx.slug) throw new UserError("Escribe exactamente el subdominio de la empresa para confirmar.");
  await systemDb().delete(organization).where(eq(organization.id, ctx.tenantId));
  (await cookies()).delete(ACTIVE_TENANT_COOKIE);
  return { ok: true };
});

/** Right to erasure for one contact: anonymises when invoices must be kept (legal retention), deletes otherwise. */
export const eraseContact = tenantAction(z.object({ contactId: z.string().uuid() }), "configuracion", async ({ contactId }, tx, ctx) => {
  const [c] = await tx.select().from(contacts).where(eq(contacts.id, contactId));
  if (!c) throw new UserError("Contacto no encontrado");
  const inv = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientId, contactId)).limit(1);
  await tx.delete(contactPersons).where(eq(contactPersons.contactId, contactId));
  if (inv.length) {
    await tx.update(contacts).set({ name: `Contacto anonimizado ${contactId.slice(0, 8)}`, email: null, phone: null, website: null, notes: null, tags: [], archived: true }).where(eq(contacts.id, contactId));
    await tx.update(contactAddresses).set({ line1: "—", lat: null, lng: null }).where(eq(contactAddresses.contactId, contactId));
    await audit(tx, ctx, "contact", contactId, "borrar", { rgpd: "anonimizado (facturas conservadas por obligación legal)" });
    return { mode: "anonimizado" as const };
  }
  await tx.delete(contacts).where(eq(contacts.id, contactId));
  await audit(tx, ctx, "contact", contactId, "borrar", { rgpd: "eliminado" });
  return { mode: "eliminado" as const };
});

