import Link from "next/link";
import { Clock, Download } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PersonalTabs } from "@/components/crew/personal-tabs";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { tenantDb } from "@/server/context";
import { loadRegister } from "@/server/crew/register";
import { madridDay } from "@/server/crew/hours";
import { RegisterView } from "./register-view";

export const metadata = { title: "Fichajes" };

export default async function TimePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const month = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : madridDay(new Date()).slice(0, 7);
  const { r, canEdit } = await tenantDb(async (tx, ctx) => ({ r: await loadRegister(tx, month), canEdit: can(ctx.role, "personal") }));
  return (
    <>
      <PageHeader icon={Clock} title="Personal" subtitle="Registro horario">
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/personal/fichajes/export?month=${month}`} prefetch={false}>
              <Download /> Exportar nóminas
            </Link>
          </Button>
        )}
      </PageHeader>
      <PersonalTabs />
      <PageBody>
        <RegisterView
          month={month}
          canEdit={canEdit}
          workers={r.workers.map((w) => ({ id: w.id, name: w.name, color: w.color }))}
          rows={r.rows}
          entries={r.entries.map((e) => ({ id: e.id, workerId: e.workerId, shiftId: e.shiftId, clockIn: e.clockIn.toISOString(), clockOut: e.clockOut?.toISOString() ?? null, breakMinutes: e.breakMinutes, diet: e.diet, source: e.source, editReason: e.editReason, editedBy: e.editedBy, hasGeo: e.latIn != null }))}
        />
      </PageBody>
    </>
  );
}
