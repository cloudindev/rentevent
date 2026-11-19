"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, venues } from "@rentevent/db";
import { geocode } from "@/lib/adapters/maps";
import { tenantAction, UserError, zId, zOptText, zText } from "../action";
import { audit, diffOf } from "../audit";

const venueSchema = z.object({
  id: zId.optional().nullable(),
  name: zText(160).min(2, "Indica el nombre del espacio"),
  address: zText(300),
  city: zText(120),
  contactId: zId.optional().nullable(),
  groundType: z.enum(["cesped", "tierra", "asfalto", "hormigon", "adoquin", "arena", "grava", "otro"]),
  anchoringAllowed: z.boolean(),
  accessNotes: zOptText(2000),
  restrictions: zOptText(2000),
  maxVehicle: zOptText(120),
  metresPerPixel: z.coerce.number().positive().max(10).optional().nullable(),
});

export const saveVenue = tenantAction(venueSchema, "comercial", async (input, tx, ctx) => {
  const g = await geocode([input.address, input.city].filter(Boolean).join(", "));
  const values = { ...input, id: undefined, contactId: input.contactId || null, lat: g?.lat ?? null, lng: g?.lng ?? null };
  if (input.id) {
    const [before] = await tx.select().from(venues).where(eq(venues.id, input.id));
    if (!before) throw new UserError("Espacio no encontrado");
    const [after] = await tx.update(venues).set(values).where(eq(venues.id, input.id)).returning();
    await audit(tx, ctx, "venue", input.id, "editar", diffOf(before, after));
    revalidatePath("/app/espacios", "layout");
    return { id: input.id, geocoded: g?.precision ?? null };
  }
  const [row] = await tx.insert(venues).values(values).returning({ id: venues.id });
  await audit(tx, ctx, "venue", row!.id, "crear", { name: input.name });
  revalidatePath("/app/espacios", "layout");
  return { id: row!.id, geocoded: g?.precision ?? null };
});

export const deleteVenue = tenantAction(z.object({ id: zId }), "comercial", async ({ id }, tx, ctx) => {
  await tx.delete(venues).where(eq(venues.id, id));
  await audit(tx, ctx, "venue", id, "borrar");
  revalidatePath("/app/espacios", "layout");
  return { id };
});
