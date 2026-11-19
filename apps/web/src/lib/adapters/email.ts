import "server-only";
import { outboxEmails, systemDb } from "@rentevent/db";
import { env } from "../env";

export type EmailMessage = { to: string; subject: string; html: string; text?: string; replyTo?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] };

/** Sends through SMTP when SMTP_URL is set; otherwise stores the message in the dev outbox (/dev/correo). */
export async function sendEmail(msg: EmailMessage): Promise<{ mode: "real" | "simulado"; id: string }> {
  if (env.smtpUrl) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(env.smtpUrl);
    const info = await transport.sendMail({ from: env.emailFrom, ...msg });
    return { mode: "real", id: String(info.messageId) };
  }
  const [row] = await systemDb()
    .insert(outboxEmails)
    .values({ toAddress: msg.to, subject: msg.subject, html: msg.html, text: msg.text ?? null })
    .returning({ id: outboxEmails.id });
  if (!env.isProd) console.info(`[correo simulado] → ${msg.to}: ${msg.subject}`);
  return { mode: "simulado", id: row!.id };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Minimal branded layout for transactional mail. */
export function emailLayout(opts: { title: string; body: string; cta?: { label: string; url: string }; footer?: string }) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f6f5;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e7e7e4;border-radius:14px;padding:32px">
<tr><td><img src="${env.appUrl}/brand/rentevent-logo.png" alt="Rentevent" height="22" style="height:22px"/></td></tr>
<tr><td style="padding-top:24px"><h1 style="font-size:20px;margin:0 0 12px">${esc(opts.title)}</h1>
<div style="font-size:14px;line-height:1.6;color:#333">${opts.body}</div>
${opts.cta ? `<p style="margin:24px 0"><a href="${opts.cta.url}" style="background:#e5412a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block">${esc(opts.cta.label)}</a></p><p style="font-size:12px;color:#6b6b68;word-break:break-all">${opts.cta.url}</p>` : ""}
</td></tr>
<tr><td style="padding-top:24px;border-top:1px solid #eee;font-size:12px;color:#6b6b68">${opts.footer ?? "Rentevent · Software para empresas de carpas y eventos"}</td></tr>
</table></td></tr></table></body></html>`;
}
export { esc as escapeHtml };
