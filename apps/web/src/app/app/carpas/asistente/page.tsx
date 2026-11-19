import { Tent } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { CarpasTabs } from "../tabs";
import { ManufacturerWizard } from "./wizard";

export const metadata = { title: "Asistente de fabricante" };

export default async function WizardPage() {
  const cat = await tenantDb((tx) => loadCatalog(tx), "carpas");
  return (
    <>
      <PageHeader icon={Tent} title="Carpas" />
      <CarpasTabs />
      <PageBody className="max-w-4xl">
        <div>
          <h2 className="text-lg font-semibold">Datos de tu fabricante</h2>
          <p className="text-sm text-muted-foreground">Las piezas por pórtico (pilares, placas, correas, tensores, pesos y estacas) dependen del fabricante de la estructura. Introdúcelas una vez por familia y el despiece se ajustará solo.</p>
        </div>
        <ManufacturerWizard families={cat.families.filter((f) => f.roofShape !== "jaima")} />
      </PageBody>
    </>
  );
}
