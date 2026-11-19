import { SectionTabs } from "@/components/app/section-tabs";

export function CarpasTabs() {
  return (
    <SectionTabs
      tabs={[
        { href: "/app/carpas", label: "Familias", exact: true },
        { href: "/app/carpas/ocupacion", label: "Ocupación de cerchas" },
        { href: "/app/carpas/plantillas", label: "Plantillas" },
        { href: "/app/carpas/asistente", label: "Asistente de fabricante" },
        { href: "/app/carpas/visor", label: "Visor 3D" },
      ]}
    />
  );
}
