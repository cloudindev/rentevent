"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { announcements, emails, emailTemplates, eq, inArray, tenantSettings, workers } from "@rentevent/db";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/adapters/email";
import { notify } from "@/lib/adapters/messaging";
import { env } from "@/lib/env";
import { audit } from "../audit";
import { tenantAction, UserError } from "../action";

const entity = z.enum(["order", "project", "contact"]);

export const markEmailRead = tenantAction(z.object({ id: z.string().uuid(), read: z.boolean() }), "ver", async ({ id, read }, tx) => {
  await tx.update(emails).set({ read }).where(eq(emails.id, id));
  revalidatePath("/app/emails");
  return { id };
});

export const linkEmail = tenantAction(z.object({ id: z.string().uuid(), entity: entity.nullable(), entityId: z.string().uuid().nullable() }), "comercial", async (input, tx, ctx) => {
  await tx.update(emails).set({ entity: input.entity, entityId: input.entity ? input.entityId : null }).where(eq(emails.id, input.id));
  await audit(tx, ctx, "email", input.id, "editar", { vinculo: input.entity ? `${input.entity}:${input.entityId}` : null });
  revalidatePath("/app/emails");
  return { id: input.id };
});

export const sendEmailMessage = tenantAction(
  z.object({
    to: z.string().trim().email("Correo no válido"),
    subject: z.string().trim().min(1, "Pon un asunto").max(200),
    body: z.string().trim().min(1, "Escribe el mensaje").max(20000),
    entity: entity.nullable(),
    entityId: z.string().uuid().nullable(),
    replyToId: z.string().uuid().nullable(),
  }),
  "comercial",
  async (input, tx, ctx) => {
    const [s] = await tx.select({ email: tenantSettings.email }).from(tenantSettings);
    const from = s?.email || ctx.user.email;
    let threadId: string | null = null;
    if (input.replyToId) {
      const [orig] = await tx.select().from(emails).where(eq(emails.id, input.replyToId));
      if (!orig) throw new UserError("El correo original ya no existe");
      threadId = orig.threadId ?? orig.id;
    }
    const r = await sendEmail({
      to: input.to,
      subject: input.subject,
      replyTo: from,
      html: emailLayout({ title: input.subject, body: `<p>${escapeHtml(input.body).replace(/\n/g, "<br/>")}</p>`, footer: ctx.tenantName }),
      text: input.body,
    });
    const [row] = await tx
      .insert(emails)
      .values({ direction: "saliente", fromAddress: from, toAddress: input.to, subject: input.subject, body: input.body, entity: input.entity, entityId: input.entity ? input.entityId : null, threadId, read: true, status: r.mode === "real" ? "enviado" : "simulado" })
      .returning({ id: emails.id });
    await audit(tx, ctx, "email", row!.id, "enviar", { to: input.to });
    revalidatePath("/app/emails");
    return { id: row!.id, mode: r.mode };
  },
);

export const saveEmailTemplate = tenantAction(
  z.object({ id: z.string().uuid().nullable(), key: z.string().trim().regex(/^[a-z0-9_]+$/, "Solo minúsculas, números y _").max(40), name: z.string().trim().min(2).max(80), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20000) }),
  "comercial",
  async ({ id, ...values }, tx, ctx) => {
    if (id) await tx.update(emailTemplates).set(values).where(eq(emailTemplates.id, id));
    else {
      const [dup] = await tx.select({ id: emailTemplates.id }).from(emailTemplates).where(eq(emailTemplates.key, values.key));
      if (dup) throw new UserError("Ya existe una plantilla con esa clave");
      await tx.insert(emailTemplates).values(values);
    }
    await audit(tx, ctx, "email_template", id ?? values.key, id ? "editar" : "crear");
    revalidatePath("/app/emails");
    return { ok: true };
  },
);

export const deleteEmailTemplate = tenantAction(z.object({ id: z.string().uuid() }), "comercial", async ({ id }, tx, ctx) => {
  await tx.delete(emailTemplates).where(eq(emailTemplates.id, id));
  await audit(tx, ctx, "email_template", id, "borrar");
  revalidatePath("/app/emails");
  return { id };
});

export const saveAnnouncement = tenantAction(
  z.object({ id: z.string().uuid().nullable(), title: z.string().trim().min(2, "Pon un título").max(120), body: z.string().trim().min(2, "Escribe el aviso").max(4000), pinned: z.boolean() }),
  "ver",
  async ({ id, ...values }, tx, ctx) => {
    if (id) await tx.update(announcements).set(values).where(eq(announcements.id, id));
    else await tx.insert(announcements).values({ ...values, authorName: ctx.user.name });
    await audit(tx, ctx, "announcement", id ?? "nuevo", id ? "editar" : "crear", { titulo: values.title });
    revalidatePath("/app/comunicacion");
    return { ok: true };
  },
);

export const deleteAnnouncement = tenantAction(z.object({ id: z.string().uuid() }), "ver", async ({ id }, tx, ctx) => {
  await tx.delete(announcements).where(eq(announcements.id, id));
  await audit(tx, ctx, "announcement", id, "borrar");
  revalidatePath("/app/comunicacion");
  return { id };
});

/** Sends a notice to selected workers through one or more channels; every delivery is logged. */
export const sendTeamNotice = tenantAction(
  z.object({
    title: z.string().trim().min(2, "Pon un título").max(120),
    body: z.string().trim().min(2, "Escribe el mensaje").max(2000),
    channels: z.array(z.enum(["push", "email", "whatsapp", "interno"])).min(1, "Elige al menos un canal"),
    workerIds: z.array(z.string().uuid()).min(1, "Elige al menos un destinatario"),
    pin: z.boolean(),
  }),
  "personal",
  async (input, tx, ctx) => {
    const people = await tx.select().from(workers).where(inArray(workers.id, input.workerIds));
    let sent = 0;
    let skipped = 0;
    for (const w of people) {
      for (const ch of input.channels) {
        const recipient = ch === "email" ? w.email : ch === "whatsapp" ? w.phone : w.name;
        if (!recipient) {
          skipped++;
          continue;
        }
        await notify(tx, { channel: ch, recipient, userId: w.userId, title: input.title, body: input.body, url: `${env.appUrl}/m` });
        sent++;
      }
    }
    if (input.pin) await tx.insert(announcements).values({ title: input.title, body: input.body, authorName: ctx.user.name, pinned: true });
    await audit(tx, ctx, "notice", "equipo", "enviar", { destinatarios: people.length, canales: input.channels });
    revalidatePath("/app/comunicacion");
    return { sent, skipped };
  },
);
