import type { Metadata } from "next";
import { Tent } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { VisorClient } from "./visor-client";

export const metadata: Metadata = { title: "Visor 3D de carpas" };

export default async function VisorPage() {
  const catalog = await tenantDb((tx) => loadCatalog(tx));
  return (
    <>
      <PageHeader icon={Tent} title="Visor 3D" back={{ href: "/app/carpas", label: "Carpas" }} subtitle="Configura y comprueba el despiece en vivo" />
      {catalog.families.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={Tent} title="Aún no hay familias de carpa" description="Crea una familia en Carpas para poder verla en 3D." />
        </div>
      ) : (
        <VisorClient families={catalog.families} items={catalog.items} rules={catalog.rules} vehicles={catalog.vehicles} />
      )}
    </>
  );
}
