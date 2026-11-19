import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, outboxEmails, systemDb } from "@rentevent/db";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";
import { Logo } from "@/components/brand";

export const metadata: Metadata = { title: "Buzón de pruebas", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Simulated mail transport viewer (only without SMTP and in demo/local mode). */
export default async function DevOutbox() {
  if (env.smtpUrl || (env.isProd && !env.demoMode)) notFound();
  const mails = await systemDb().select().from(outboxEmails).orderBy(desc(outboxEmails.createdAt)).limit(30);
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Logo />
      <h1 className="text-xl font-semibold">Buzón de pruebas</h1>
      <p className="text-sm text-muted-foreground">Correos generados en modo simulado (sin SMTP configurado). Los enlaces funcionan igual que en producción.</p>
      {mails.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay correos todavía.</p>}
      {mails.map((m) => (
        <details key={m.id} className="rounded-xl border p-4" open={mails[0]?.id === m.id}>
          <summary className="cursor-pointer text-sm">
            <strong>{m.subject}</strong> → {m.toAddress} · <span className="text-muted-foreground">{formatDateTime(m.createdAt)}</span>
          </summary>
          <iframe title={m.subject} srcDoc={m.html} className="mt-3 h-[420px] w-full rounded-lg border bg-white" sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" />
        </details>
      ))}
    </div>
  );
}
