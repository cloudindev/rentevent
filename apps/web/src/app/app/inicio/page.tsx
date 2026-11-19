import { House } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireApp } from "@/server/context";

export default async function HomePage() {
  const ctx = await requireApp();
  return (
    <>
      <PageHeader icon={House} title="Inicio" />
      <PageBody>
        <p className="text-sm text-muted-foreground">Hola, {ctx.user.name}.</p>
      </PageBody>
    </>
  );
}
