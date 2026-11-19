import "server-only";
import { randomBytes } from "node:crypto";
import { counters, emailTemplates, eq, invoiceSeries, member, organization, systemDb, tenantSettings, warehouses, withTenant, workflows } from "@rentevent/db";
import { DEFAULT_PRICING } from "@rentevent/core";

const RESERVED = new Set(["www", "app", "api", "admin", "static", "mail", "demo", "soporte", "ayuda", "blog", "status", "doble-factor"]);

export function normaliseSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export async function slugAvailable(slug: string) {
  if (slug.length < 3 || RESERVED.has(slug)) return false;
  const [row] = await systemDb().select({ id: organization.id }).from(organization).where(eq(organization.slug, slug));
  return !row;
}

export const TRIAL_DAYS = 14;

/** Creates a company workspace with sensible defaults and the user as administrator. */
export async function provisionTenant(input: { name: string; slug: string; userId: string; email: string }) {
  const id = `org_${randomBytes(10).toString("hex")}`;
  const db = systemDb();
  await db.insert(organization).values({ id, name: input.name, slug: input.slug });
  await db.insert(member).values({ id: `mem_${randomBytes(10).toString("hex")}`, organizationId: id, userId: input.userId, role: "administrador" });
  const year = new Date().getFullYear();
  await withTenant(id, async (tx) => {
    await tx.insert(tenantSettings).values({
      legalName: input.name,
      email: input.email,
      pricing: DEFAULT_PRICING,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
      subscriptionStatus: "trialing",
      plan: "trial",
      onboardingDone: false,
      quoteTerms: "Precios sin IVA. Incluye montaje y desmontaje. La reserva se confirma con la aceptación del presupuesto.",
    });
    await tx.insert(counters).values([
      { key: "pedido", value: Number(String(year).slice(2)) * 10000 },
      { key: "proyecto", value: 0 },
      { key: "albaran", value: 0 },
    ]);
    await tx.insert(invoiceSeries).values([
      { code: "F", name: "Facturas", kind: "normal", year },
      { code: "R", name: "Rectificativas", kind: "rectificativa", year },
      { code: "A", name: "Anticipos", kind: "anticipo", year },
    ]);
    await tx.insert(warehouses).values({ name: "Almacén principal" });
    await tx.insert(emailTemplates).values([
      { key: "presupuesto", name: "Envío de presupuesto", subject: "Presupuesto {{pedido}} · {{evento}}", body: "Hola {{cliente}},\n\nTe enviamos el presupuesto para {{evento}}. Puedes verlo, ver la carpa en 3D y aceptarlo en línea: {{enlace}}\n\nUn saludo,\n{{empresa}}" },
      { key: "confirmacion", name: "Confirmación de pedido", subject: "Pedido {{pedido}} confirmado", body: "Hola {{cliente}},\n\nTu pedido para {{evento}} está confirmado.\n\n{{empresa}}" },
      { key: "recordatorio_devolucion", name: "Recordatorio de devolución", subject: "Recogida del material · {{evento}}", body: "Hola {{cliente}},\n\nLa recogida será el {{retorno}}.\n\n{{empresa}}" },
    ]);
    await tx.insert(workflows).values({ name: "Caducar opciones vencidas", trigger: "diario", conditions: [], action: { type: "caducar_opciones" }, active: true });
  });
  return { id, slug: input.slug };
}
