import { SectionTabs } from "@/components/app/section-tabs";

export function MaintenanceTabs() {
  return (
    <SectionTabs
      tabs={[
        { href: "/app/mantenimiento", label: "Reparaciones", exact: true },
        { href: "/app/mantenimiento/revisiones", label: "Revisiones" },
        { href: "/app/mantenimiento/limpieza", label: "Limpieza de lonas" },
        { href: "/app/mantenimiento/historial", label: "Historial" },
      ]}
    />
  );
}
