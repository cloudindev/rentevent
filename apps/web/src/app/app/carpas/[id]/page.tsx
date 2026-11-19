import { notFound } from "next/navigation";
import { Tent } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { loadCatalog } from "@/server/catalog";
import { tenantDb } from "@/server/context";
import { FamilyEditor } from "./family-editor";

export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cat, role } = await tenantDb(async (tx, ctx) => ({ cat: await loadCatalog(tx, { includeInactive: true }), role: ctx.role }));
  const family = cat.families.find((f) => f.id === id);
  if (!family) notFound();
  return (
    <>
      <PageHeader icon={Tent} title={family.name} back={{ href: "/app/carpas", label: "Carpas" }} subtitle={family.code} />
      <FamilyEditor family={family} rules={cat.rules.filter((r) => r.familyId === id)} items={cat.items} vehicles={cat.vehicles} canEdit={can(role, "carpas")} />
    </>
  );
}
