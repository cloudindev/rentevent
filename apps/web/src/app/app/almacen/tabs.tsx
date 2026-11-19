import { SectionTabs } from "@/components/app/section-tabs";

export function AlmacenTabs() {
  return (
    <SectionTabs
      tabs={[
        { href: "/app/almacen", label: "Salidas", exact: true },
        { href: "/app/almacen/retornos", label: "Retornos" },
        { href: "/app/almacen/albaranes", label: "Albaranes" },
        { href: "/app/almacen/recuentos", label: "Recuentos" },
      ]}
    />
  );
}
