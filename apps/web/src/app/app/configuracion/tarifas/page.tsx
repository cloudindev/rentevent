import { PageBody } from "@/components/app/page-header";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { tenantPricing } from "@/server/orders";
import { PricingForm } from "./pricing-form";

export const metadata = { title: "Tarifas" };

export default async function PricingPage() {
  const d = await tenantDb(async (tx) => ({ pricing: (await tenantPricing(tx)).pricing, families: (await loadCatalog(tx)).families }), "configuracion");
  return (
    <PageBody className="max-w-4xl">
      <PricingForm initial={d.pricing} families={d.families.filter((f) => f.roofShape !== "jaima").map((f) => ({ id: f.id, name: f.name, price: f.price, priceMode: f.priceMode }))} />
    </PageBody>
  );
}
