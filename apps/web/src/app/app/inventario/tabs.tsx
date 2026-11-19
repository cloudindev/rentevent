import { SectionTabs } from "@/components/app/section-tabs";

export function InventoryTabs() {
  return (
    <SectionTabs
      tabs={[
        { href: "/app/inventario", label: "Artículos", exact: true },
        { href: "/app/inventario/kits", label: "Kits" },
      ]}
    />
  );
}
