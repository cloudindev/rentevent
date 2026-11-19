import { PageBody } from "@/components/app/page-header";
import { can } from "@/lib/permissions";
import { requireApp } from "@/server/context";
import { Importer } from "./importer";

export const metadata = { title: "Importar datos" };

export default async function ImportPage() {
  const ctx = await requireApp();
  return (
    <PageBody className="max-w-5xl">
      <Importer allowed={{ inventario: can(ctx.role, "inventario"), contactos: can(ctx.role, "comercial"), proyectos: can(ctx.role, "comercial") }} />
    </PageBody>
  );
}
