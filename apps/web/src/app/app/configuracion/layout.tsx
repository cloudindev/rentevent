import { Settings } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SectionTabs } from "@/components/app/section-tabs";
import { can } from "@/lib/permissions";
import { requireApp } from "@/server/context";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireApp();
  const admin = can(ctx.role, "configuracion");
  const tabs = [
    { href: "/app/configuracion", label: "Empresa", exact: true, show: admin },
    { href: "/app/configuracion/usuarios", label: "Usuarios y roles", show: can(ctx.role, "usuarios") },
    { href: "/app/configuracion/tarifas", label: "Tarifas", show: admin },
    { href: "/app/configuracion/impuestos", label: "Impuestos y series", show: admin },
    { href: "/app/configuracion/plantillas", label: "Plantillas", show: admin },
    { href: "/app/configuracion/suscripcion", label: "Suscripción", show: admin },
    { href: "/app/configuracion/importar", label: "Importar", show: can(ctx.role, "inventario") || can(ctx.role, "comercial") },
    { href: "/app/configuracion/api", label: "API y webhooks", show: admin },
    { href: "/app/configuracion/seguridad", label: "Seguridad y datos", show: admin },
    { href: "/app/configuracion/integraciones", label: "Integraciones", show: admin },
  ].filter((t) => t.show);
  return (
    <>
      <PageHeader icon={Settings} title="Configuración" subtitle={ctx.tenantName} />
      {tabs.length > 0 && <SectionTabs tabs={tabs} />}
      {children}
    </>
  );
}
