"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contactAddresses, contactPersons, contacts, eq, notes } from "@rentevent/db";
import { geocode } from "@/lib/adapters/maps";
import { audit, diffOf } from "../audit";
import { tenantAction, UserError } from "../action";

const contactInput = z.object({
  id: z.string().uuid().nullable(),
  kind: z.enum(["cliente", "proveedor", "localizacion"]),
  name: z.string().trim().min(2, "Obligatorio").max(120),
  legalName: z.string().trim().max(160).nullable(),
  taxId: z.string().trim().max(20).nullable(),
  email: z.string().trim().email("Correo no válido").max(160).nullable().or(z.literal("").transform(() => null)),
  phone: z.string().trim().max(40).nullable(),
  website: z.string().trim().max(160).nullable(),
  discountPct: z.coerce.number().min(0).max(100),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  tags: z.array(z.string().trim().max(30)).max(20),
  notes: z.string().trim().max(2000).nullable(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
});

export const saveContact = tenantAction(contactInput, "comercial", async (input, tx, ctx) => {
  const { id, address, city, ...values } = input;
  if (id) {
    const [before] = await tx.select().from(contacts).where(eq(contacts.id, id));
    if (!before) throw new UserError("Contacto no encontrado");
    await tx.update(contacts).set(values).where(eq(contacts.id, id));
    await audit(tx, ctx, "contact", id, "editar", diffOf(before, { ...before, ...values }));
    revalidatePath(`/app/contactos/${id}`);
    return { id };
  }
  const [row] = await tx.insert(contacts).values(values).returning({ id: contacts.id });
  if (address) {
    const g = await geocode(`${address}, ${city ?? ""}`);
    await tx.insert(contactAddresses).values({ contactId: row!.id, line1: address, city: city ?? "", lat: g?.lat ?? null, lng: g?.lng ?? null, isDefault: true });
  }
  await audit(tx, ctx, "contact", row!.id, "crear");
  revalidatePath("/app/contactos");
  return { id: row!.id };
});

export const saveAddress = tenantAction(
  z.object({ id: z.string().uuid().nullable(), contactId: z.string().uuid(), label: z.string().trim().min(1).max(40), line1: z.string().trim().min(3).max(200), city: z.string().trim().max(80), province: z.string().trim().max(80), postalCode: z.string().trim().max(10), isDefault: z.boolean() }),
  "comercial",
  async (input, tx, ctx) => {
    const g = await geocode(`${input.line1}, ${input.postalCode} ${input.city}, ${input.province}`);
    const values = { ...input, id: undefined, lat: g?.lat ?? null, lng: g?.lng ?? null };
    if (input.isDefault) await tx.update(contactAddresses).set({ isDefault: false }).where(eq(contactAddresses.contactId, input.contactId));
    if (input.id) await tx.update(contactAddresses).set(values).where(eq(contactAddresses.id, input.id));
    else await tx.insert(contactAddresses).values(values);
    await audit(tx, ctx, "contact", input.contactId, "editar", { direccion: input.line1, geocodificacion: g?.precision ?? "sin resultado" });
    revalidatePath(`/app/contactos/${input.contactId}`);
    return { lat: g?.lat ?? null, lng: g?.lng ?? null, precision: g?.precision ?? null };
  },
);

export const deleteAddress = tenantAction(z.object({ id: z.string().uuid(), contactId: z.string().uuid() }), "comercial", async ({ id, contactId }, tx) => {
  await tx.delete(contactAddresses).where(eq(contactAddresses.id, id));
  revalidatePath(`/app/contactos/${contactId}`);
  return { id };
});

export const savePerson = tenantAction(
  z.object({ id: z.string().uuid().nullable(), contactId: z.string().uuid(), name: z.string().trim().min(2).max(120), position: z.string().trim().max(80).nullable(), email: z.string().trim().max(160).nullable(), phone: z.string().trim().max(40).nullable() }),
  "comercial",
  async (input, tx, ctx) => {
    const values = { ...input, id: undefined };
    if (input.id) await tx.update(contactPersons).set(values).where(eq(contactPersons.id, input.id));
    else await tx.insert(contactPersons).values(values);
    await audit(tx, ctx, "contact", input.contactId, "editar", { persona: input.name });
    revalidatePath(`/app/contactos/${input.contactId}`);
    return { ok: true };
  },
);

export const deletePerson = tenantAction(z.object({ id: z.string().uuid(), contactId: z.string().uuid() }), "comercial", async ({ id, contactId }, tx) => {
  await tx.delete(contactPersons).where(eq(contactPersons.id, id));
  revalidatePath(`/app/contactos/${contactId}`);
  return { id };
});

export const archiveContact = tenantAction(z.object({ id: z.string().uuid(), archived: z.boolean() }), "comercial", async ({ id, archived }, tx, ctx) => {
  await tx.update(contacts).set({ archived }).where(eq(contacts.id, id));
  await audit(tx, ctx, "contact", id, archived ? "borrar" : "editar", { archivado: archived });
  revalidatePath("/app/contactos");
  return { id };
});

/** Notes attach to any entity (contact, project, order). */
export const addNote = tenantAction(
  z.object({ entity: z.enum(["contact", "project", "order", "item"]), entityId: z.string().uuid(), body: z.string().trim().min(1).max(4000), path: z.string().max(200) }),
  "ver",
  async (input, tx, ctx) => {
    await tx.insert(notes).values({ entity: input.entity, entityId: input.entityId, body: input.body, authorId: ctx.user.id, authorName: ctx.user.name });
    revalidatePath(input.path);
    return { ok: true };
  },
);
