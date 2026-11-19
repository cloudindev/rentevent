"use server";
import { z } from "zod";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/adapters/email";

const schema = z.object({
  name: z.string().trim().min(2, "Indica tu nombre").max(100),
  email: z.string().trim().email("Correo no válido").max(160),
  company: z.string().trim().min(2, "Indica tu empresa").max(120),
  phone: z.string().trim().max(30).optional().default(""),
  size: z.enum(["1-5", "6-20", "21-50", "50+"]),
  message: z.string().trim().max(2000).optional().default(""),
  privacy: z.literal(true, { message: "Debes aceptar la política de privacidad" }),
  website: z.string().max(0).optional().default(""),
});

export type ContactState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

const SALES_INBOX = process.env.SALES_EMAIL ?? "ventas@rentevent.es";

export async function requestDemo(input: z.input<typeof schema>): Promise<ContactState> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Revisa los campos marcados.", fieldErrors };
  }
  const d = parsed.data;
  if (d.website) return { ok: true }; // honeypot
  const rows = [
    ["Nombre", d.name],
    ["Correo", d.email],
    ["Empresa", d.company],
    ["Teléfono", d.phone || "—"],
    ["Personas en la empresa", d.size],
    ["Mensaje", d.message || "—"],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b6b68">${k}</td><td>${escapeHtml(v!)}</td></tr>`)
    .join("");
  try {
    await sendEmail({
      to: SALES_INBOX,
      replyTo: d.email,
      subject: `Solicitud de demo · ${d.company}`,
      html: emailLayout({ title: "Nueva solicitud de demo", body: `<table>${rows}</table>` }),
      text: `${d.name} <${d.email}> · ${d.company} · ${d.size}\n${d.message}`,
    });
  } catch {
    return { ok: false, error: "No hemos podido enviar la solicitud. Escríbenos a ventas@rentevent.es." };
  }
  return { ok: true };
}
