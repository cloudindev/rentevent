import Link from "next/link";
import { SKILL_LABELS, type Skill } from "@rentevent/core";
import { TrainingPill } from "@/components/crew/bits";
import { CopyField, SignOutButton } from "@/components/crew/profile-actions";
import { PushToggle } from "@/components/crew/push-toggle";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { icsToken } from "@/server/crew/ics";
import { mobileContext } from "@/server/crew/mobile";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const { ctx, worker } = await mobileContext();
  const icsUrl = worker ? `${env.appUrl}/api/v1/ics/${icsToken(worker.id, env.authSecret)}.ics` : null;
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Perfil</h1>
      <section className="space-y-1 rounded-xl border bg-background p-4 text-sm">
        <p className="text-base font-medium">{worker?.name ?? ctx.user.name}</p>
        <p className="text-muted-foreground">{ctx.user.email}</p>
        <p className="text-muted-foreground">{ctx.tenantName}</p>
        {worker && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            <TrainingPill expires={worker.trainingExpiresAt} />
            {worker.skills.map((s) => (
              <span key={s} className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {SKILL_LABELS[s as Skill] ?? s}
              </span>
            ))}
          </div>
        )}
      </section>
      {icsUrl && (
        <section className="space-y-2 rounded-xl border bg-background p-4">
          <h2 className="text-sm font-semibold">Calendario</h2>
          <p className="text-sm text-muted-foreground">Suscríbete desde Google Calendar, Outlook o el calendario del iPhone para ver tus turnos publicados.</p>
          <CopyField value={icsUrl} label="enlace del calendario" />
          <a className="inline-block text-sm text-link underline" href={icsUrl.replace(/^https?:/, "webcal:")}>
            Abrir en el calendario
          </a>
        </section>
      )}
      <section className="space-y-2 rounded-xl border bg-background p-4">
        <h2 className="text-sm font-semibold">Notificaciones</h2>
        <PushToggle vapidKey={env.vapid?.publicKey ?? null} />
      </section>
      {can(ctx.role, "ver") && (
        <Link href="/app/inicio" className="block rounded-xl border bg-background p-4 text-sm font-medium">
          Abrir la aplicación completa →
        </Link>
      )}
      <SignOutButton />
    </div>
  );
}
