import { and, assignments, eq, gte, ne, projects, shifts, systemDb, withTenant, workers } from "@rentevent/db";
import { PHASE_LABELS, type PhaseKind } from "@rentevent/core";
import { env } from "@/lib/env";
import { buildIcs, verifyIcsToken } from "@/server/crew/ics";

/**
 * Personal calendar feed (ICS) of a worker's published shifts. The token is
 * `workerId.HMAC`; the worker's tenant is resolved with the privileged
 * connection, then data is read under RLS for that tenant only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const workerId = verifyIcsToken(decodeURIComponent(token).replace(/\.ics$/, ""), env.authSecret);
  if (!workerId || !/^[0-9a-f-]{36}$/.test(workerId)) return new Response("No encontrado", { status: 404 });
  const [w] = await systemDb().select({ tenantId: workers.tenantId, name: workers.name }).from(workers).where(eq(workers.id, workerId));
  if (!w) return new Response("No encontrado", { status: 404 });
  const rows = await withTenant(w.tenantId, (tx) =>
    tx
      .select({ s: shifts, project: projects.name })
      .from(assignments)
      .innerJoin(shifts, eq(shifts.id, assignments.shiftId))
      .leftJoin(projects, eq(projects.id, shifts.projectId))
      .where(and(eq(assignments.workerId, workerId), ne(assignments.status, "rechazado"), eq(shifts.published, true), gte(shifts.endsAt, new Date(Date.now() - 30 * 86_400_000)))),
  );
  const ics = buildIcs(
    `Rentevent · ${w.name}`,
    rows.map(({ s, project }) => ({
      uid: s.id,
      start: s.startsAt,
      end: s.endsAt,
      summary: `${PHASE_LABELS[s.phaseKind as PhaseKind] ?? s.phaseKind} · ${project ?? s.title}`,
      location: s.address,
      description: `${env.appUrl}/m/turno/${s.id}`,
    })),
  );
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
