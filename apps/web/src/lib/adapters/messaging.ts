import "server-only";
import { notifications, pushSubscriptions, eq, type Tx } from "@rentevent/db";
import { env } from "../env";
import { sendEmail, emailLayout, escapeHtml } from "./email";

export type Channel = "push" | "email" | "whatsapp" | "interno";

/**
 * Sends a notification through one channel and records it in the
 * communication log. Without credentials the delivery is simulated but the
 * log entry is still written (status "simulada").
 */
export async function notify(
  tx: Tx,
  input: { channel: Channel; recipient: string; userId?: string | null; title: string; body: string; entity?: string; entityId?: string; url?: string },
) {
  let status = "enviada";
  if (input.channel === "email") {
    const r = await sendEmail({
      to: input.recipient,
      subject: input.title,
      html: emailLayout({ title: input.title, body: `<p>${escapeHtml(input.body).replace(/\n/g, "<br/>")}</p>`, cta: input.url ? { label: "Abrir en Rentevent", url: input.url } : undefined }),
      text: input.body,
    });
    status = r.mode === "real" ? "enviada" : "simulada";
  } else if (input.channel === "whatsapp") {
    if (env.whatsapp) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${env.whatsapp.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.whatsapp.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: input.recipient.replace(/\D/g, ""), type: "text", text: { body: `${input.title}\n${input.body}` } }),
      });
      status = res.ok ? "enviada" : "error";
    } else status = "simulada";
  } else if (input.channel === "push") {
    if (env.vapid && input.userId) {
      const webpush = (await import("web-push")).default;
      webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
      const subs = await tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, input.userId));
      let ok = 0;
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as { p256dh: string; auth: string } }, JSON.stringify({ title: input.title, body: input.body, url: input.url }));
          ok++;
        } catch {
          await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        }
      }
      status = ok > 0 ? "enviada" : "sin_dispositivo";
    } else status = "simulada";
  }
  const [row] = await tx
    .insert(notifications)
    .values({ channel: input.channel, recipient: input.recipient, userId: input.userId ?? null, title: input.title, body: input.body, entity: input.entity ?? null, entityId: input.entityId ?? null, status })
    .returning();
  return row!;
}
