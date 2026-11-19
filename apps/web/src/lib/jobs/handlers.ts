import "server-only";
import { and, eq, member, orders, organization, projects, systemDb, user, withTenant } from "@rentevent/db";
import { expireOptions } from "@rentevent/db/services";
import { notify, type Channel } from "../adapters/messaging";
import { sendEmail } from "../adapters/email";
import { env } from "../env";
import { registerHandler } from "./index";

/** Built-in job handlers. Imported once for its side effect. */
registerHandler("caducar_opciones", async (payload, meta) => {
  const tenantIds = meta.tenantId ? [meta.tenantId] : (await systemDb().select({ id: organization.id }).from(organization)).map((r) => r.id);
  let total = 0;
  for (const tenantId of tenantIds) {
    await withTenant(tenantId, async (tx) => {
      const expired = await expireOptions(tx);
      total += expired.length;
      for (const o of expired) {
        const [p] = await tx.select({ managerId: projects.managerId }).from(orders).innerJoin(projects, eq(projects.id, orders.projectId)).where(eq(orders.id, o.id));
        const managerId = p?.managerId ?? null;
        const [m] = managerId ? await tx.select({ email: user.email, name: user.name }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(eq(member.userId, managerId))) : [];
        await notify(tx, {
          channel: "interno",
          recipient: m?.name ?? "Comerciales",
          userId: managerId,
          title: `Opción caducada · ${o.number}`,
          body: `La opción del pedido ${o.number} (${o.title}) ha caducado y ha pasado a consulta: ya no reserva material.`,
          entity: "order",
          entityId: o.id,
          url: `${env.appUrl}/app/pedidos/${o.id}`,
        });
      }
    });
  }
  void payload;
  return { caducadas: total };
});

registerHandler("enviar_email", async (payload) => {
  const p = payload as { to: string; subject: string; html: string; text?: string };
  if (!p.to || !p.subject) throw new Error("enviar_email: faltan destinatario o asunto");
  return sendEmail({ to: p.to, subject: p.subject, html: p.html ?? `<p>${p.text ?? ""}</p>`, text: p.text });
});

registerHandler("notificar", async (payload, meta) => {
  const p = payload as { channel: Channel; recipient: string; userId?: string | null; title: string; body: string; entity?: string; entityId?: string };
  if (!meta.tenantId) throw new Error("notificar: falta la empresa");
  const row = await withTenant(meta.tenantId, (tx) => notify(tx, p));
  return { id: row.id, status: row.status };
});

registerHandler("workflow", async (payload, meta) => {
  if (!meta.tenantId) throw new Error("workflow: falta la empresa");
  const { runWorkflowById } = await import("@/server/workflows");
  return runWorkflowById(meta.tenantId, String(payload.workflowId), (payload.entity as { type: "order"; id: string } | undefined) ?? null);
});
