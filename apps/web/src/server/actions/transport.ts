"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, shifts, vehicles } from "@rentevent/db";
import { tenantAction, UserError, zId, zOptText, zText } from "../action";
import { audit, diffOf } from "../audit";

const vehicleSchema = z.object({
  id: zId.optional().nullable(),
  name: zText(120).min(2, "Indica un nombre"),
  plate: zText(20),
  kind: z.enum(["camion", "furgoneta", "trailer", "remolque", "grua"]),
  maxPayloadKg: z.coerce.number().min(1, "Indica la carga útil").max(60000),
  volumeM3: z.coerce.number().min(0.1, "Indica el volumen").max(200),
  licenceRequired: z.enum(["conductor_b", "conductor_c", "conductor_ce"]),
  itvUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().nullable(),
  costPerKm: z.coerce.number().min(0).max(20),
  active: z.boolean().default(true),
});

export const saveVehicle = tenantAction(vehicleSchema, "transporte", async (input, tx, ctx) => {
  const values = { ...input, id: undefined, itvUntil: input.itvUntil || null };
  if (input.id) {
    const [before] = await tx.select().from(vehicles).where(eq(vehicles.id, input.id));
    if (!before) throw new UserError("Vehículo no encontrado");
    const [after] = await tx.update(vehicles).set(values).where(eq(vehicles.id, input.id)).returning();
    await audit(tx, ctx, "vehicle", input.id, "editar", diffOf(before, after));
    revalidatePath("/app/transporte");
    return { id: input.id };
  }
  const [row] = await tx.insert(vehicles).values(values).returning({ id: vehicles.id });
  await audit(tx, ctx, "vehicle", row!.id, "crear", { name: input.name });
  revalidatePath("/app/transporte");
  return { id: row!.id };
});

export const assignVehicle = tenantAction(z.object({ shiftId: zId, vehicleId: zId.optional().nullable(), note: zOptText(300) }), "transporte", async (input, tx, ctx) => {
  await tx.update(shifts).set({ vehicleId: input.vehicleId || null }).where(eq(shifts.id, input.shiftId));
  await audit(tx, ctx, "shift", input.shiftId, "editar", { vehiculo: input.vehicleId ?? null });
  revalidatePath("/app/transporte");
  revalidatePath("/app/personal/tablero");
  return { ok: true };
});
