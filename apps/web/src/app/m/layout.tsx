import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { MobileShell } from "@/components/crew/mobile-shell";
import { getAppContext, getAuthSession } from "@/server/context";

export const metadata: Metadata = { title: { default: "Mi agenda", template: "%s · Rentevent" }, manifest: "/manifest.webmanifest", robots: { index: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const s = await getAuthSession();
  if (!s) redirect("/acceso?next=/m");
  const ctx = await getAppContext();
  if (!ctx) redirect("/registro/empresa");
  return <MobileShell company={ctx.tenantName}>{children}</MobileShell>;
}
