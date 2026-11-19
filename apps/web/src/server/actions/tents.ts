"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, bomRules, eq, structureFamilies, tenantSettings, tentTemplates } from "@rentevent/db";
import { BOM_GROUPS, compositionSchema, DEFAULT_LABOR, HEIGHT_CLASSES, laborRatiosSchema, ROOF_SHAPES, validateFormula, variableNamesFor } from "@rentevent/core";
import { audit, diffOf } from "../audit";
import { tenantAction, UserError } from "../action";

const familyInput = z.object({
  id: z.string().uuid().nullable(),
  code: z.string().trim().min(1, "Obligatorio").max(16),
  name: z.string().trim().min(2, "Obligatorio").max(80),
  width: z.coerce.number().positive().max(60),
  moduleLength: z.coerce.number().positive().max(20),
  eaveHeight: z.coerce.number().positive().max(15),
  ridgeHeight: z.coerce.number().positive().max(25),
  heightClass: z.enum(HEIGHT_CLASSES),
  roofShape: z.enum(ROOF_SHAPES),
  trussItemId: z.string().uuid().nullable(),
  minModules: z.coerce.number().int().min(1).max(60),
  maxModules: z.coerce.number().int().min(1).max(60),
  priceMode: z.enum(["m2", "ml"]),
  price: z.coerce.number().min(0).max(10000),
  active: z.boolean(),
  parameters: z.record(z.string().regex(/^[a-z_][a-z0-9_]*$/, "Nombre no válido"), z.coerce.number()),
  labor: laborRatiosSchema,
});

export const saveFamily = tenantAction(familyInput, "carpas", async (input, tx, ctx) => {
  if (input.ridgeHeight < input.eaveHeight) throw new UserError("La cumbrera no puede ser más baja que el alero.");
  if (input.maxModules < input.minModules) throw new UserError("El máximo de módulos debe ser mayor o igual que el mínimo.");
  const values = { ...input, id: undefined, parametersPending: false };
  if (input.id) {
    const [before] = await tx.select().from(structureFamilies).where(eq(structureFamilies.id, input.id));
    if (!before) throw new UserError("Familia no encontrada");
    await tx.update(structureFamilies).set(values).where(eq(structureFamilies.id, input.id));
    await audit(tx, ctx, "structure_family", input.id, "editar", diffOf(before, { ...before, ...values }));
    revalidatePath(`/app/carpas/${input.id}`);
    return { id: input.id };
  }
  const [row] = await tx.insert(structureFamilies).values({ ...values, labor: input.labor ?? DEFAULT_LABOR }).returning({ id: structureFamilies.id });
  await audit(tx, ctx, "structure_family", row!.id, "crear");
  revalidatePath("/app/carpas");
  return { id: row!.id };
});

const rulesInput = z.object({
  familyId: z.string().uuid(),
  rules: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        formula: z.string().trim().min(1).max(500),
        condition: z.string().trim().max(500).nullable(),
        group: z.enum(BOM_GROUPS),
        note: z.string().trim().max(200).nullable(),
      }),
    )
    .max(200),
});

/** Replaces all rules of a family after validating every formula server-side. */
export const saveRules = tenantAction(rulesInput, "carpas", async (input, tx, ctx) => {
  const [family] = await tx.select().from(structureFamilies).where(eq(structureFamilies.id, input.familyId));
  if (!family) throw new UserError("Familia no encontrada");
  const names = variableNamesFor({ parameters: family.parameters ?? {} });
  input.rules.forEach((r, i) => {
    const f = validateFormula(r.formula, names);
    if (!f.ok) throw new UserError(`Regla ${i + 1}: ${f.error}`);
    if (r.condition) {
      const c = validateFormula(r.condition, names);
      if (!c.ok) throw new UserError(`Condición de la regla ${i + 1}: ${c.error}`);
    }
  });
  const before = await tx.select().from(bomRules).where(eq(bomRules.familyId, input.familyId));
  await tx.delete(bomRules).where(eq(bomRules.familyId, input.familyId));
  if (input.rules.length) {
    await tx.insert(bomRules).values(input.rules.map((r, i) => ({ ...r, familyId: input.familyId, sortOrder: i + 1 })));
  }
  await audit(tx, ctx, "structure_family", input.familyId, "editar", { reglas: { de: before.length, a: input.rules.length } });
  revalidatePath(`/app/carpas/${input.familyId}`);
  return { count: input.rules.length };
});

export const duplicateFamily = tenantAction(z.object({ id: z.string().uuid() }), "carpas", async ({ id }, tx, ctx) => {
  const [f] = await tx.select().from(structureFamilies).where(eq(structureFamilies.id, id));
  if (!f) throw new UserError("Familia no encontrada");
  const { id: _id, createdAt: _c, updatedAt: _u, tenantId: _t, ...rest } = f;
  const [copy] = await tx.insert(structureFamilies).values({ ...rest, code: `${f.code}-C${Date.now() % 1000}`, name: `${f.name} (copia)` }).returning();
  const rules = await tx.select().from(bomRules).where(eq(bomRules.familyId, id));
  if (rules.length) await tx.insert(bomRules).values(rules.map(({ id: _i, createdAt: _a, updatedAt: _b, tenantId: _tt, ...r }) => ({ ...r, familyId: copy!.id })));
  await audit(tx, ctx, "structure_family", copy!.id, "crear", { copiaDe: id });
  revalidatePath("/app/carpas");
  return { id: copy!.id };
});

export const deleteFamily = tenantAction(z.object({ id: z.string().uuid() }), "carpas", async ({ id }, tx, ctx) => {
  await tx.update(structureFamilies).set({ active: false }).where(eq(structureFamilies.id, id));
  await audit(tx, ctx, "structure_family", id, "borrar");
  revalidatePath("/app/carpas");
  return { id };
});

const wizardInput = z.object({
  families: z.array(z.object({ id: z.string().uuid(), parameters: z.record(z.string(), z.coerce.number().min(0).max(1000)), labor: laborRatiosSchema.partial() })),
});

/** Manufacturer wizard: per-portico quantities and labour ratios. */
export const saveManufacturerData = tenantAction(wizardInput, "carpas", async (input, tx, ctx) => {
  for (const f of input.families) {
    const [cur] = await tx.select().from(structureFamilies).where(eq(structureFamilies.id, f.id));
    if (!cur) continue;
    await tx
      .update(structureFamilies)
      .set({ parameters: { ...(cur.parameters ?? {}), ...f.parameters }, labor: { ...DEFAULT_LABOR, ...(cur.labor as object), ...f.labor }, parametersPending: false })
      .where(eq(structureFamilies.id, f.id));
  }
  await tx.update(tenantSettings).set({ manufacturerWizardDone: true });
  await audit(tx, ctx, "tenant", ctx.tenantId, "editar", { asistenteFabricante: true });
  revalidatePath("/app/carpas");
  return { ok: true };
});

export const saveTemplate = tenantAction(
  z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).nullable(), composition: compositionSchema }),
  "comercial",
  async (input, tx, ctx) => {
    const [row] = await tx.insert(tentTemplates).values(input).returning({ id: tentTemplates.id });
    await audit(tx, ctx, "tent_template", row!.id, "crear");
    revalidatePath("/app/carpas/plantillas");
    return { id: row!.id };
  },
);

export const deleteTemplate = tenantAction(z.object({ id: z.string().uuid() }), "comercial", async ({ id }, tx, ctx) => {
  await tx.delete(tentTemplates).where(and(eq(tentTemplates.id, id)));
  await audit(tx, ctx, "tent_template", id, "borrar");
  revalidatePath("/app/carpas/plantillas");
  return { id };
});
