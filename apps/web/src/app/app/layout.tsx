import { redirect } from "next/navigation";
import { CommandPaletteProvider } from "@/components/app/command-palette";
import { MobileNav } from "@/components/app/mobile-nav";
import { Sidebar } from "@/components/app/sidebar";
import { getAppContext, getAuthSession } from "@/server/context";
import { TrialBanner } from "@/components/app/trial-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getAuthSession();
  if (!s) redirect("/acceso");
  const ctx = await getAppContext();
  if (!ctx) redirect("/registro/empresa");
  if (ctx.role === "montador") redirect("/m");
  const tenant = { tenantId: ctx.tenantId, slug: ctx.slug, name: ctx.tenantName, logo: ctx.tenantLogo, role: ctx.role };
  return (
    <CommandPaletteProvider role={ctx.role}>
      <div className="min-h-dvh bg-canvas md:p-2">
        <div className="flex h-dvh overflow-hidden bg-background md:h-[calc(100dvh-16px)] md:rounded-2xl md:border">
          <Sidebar user={ctx.user} tenant={tenant} memberships={ctx.memberships} />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileNav role={ctx.role} tenantName={ctx.tenantName} />
            <TrialBanner status={ctx.subscriptionStatus} trialEndsAt={ctx.trialEndsAt?.toISOString() ?? null} />
            <main id="contenido" className="relative flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
