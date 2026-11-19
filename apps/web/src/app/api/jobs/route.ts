import { z } from "zod";
import { env } from "@/lib/env";
import { enqueue, processJobs, queueStats, registeredHandlers } from "@/lib/jobs";
import "@/lib/jobs/handlers";

export const dynamic = "force-dynamic";

const auth = (req: Request) => req.headers.get("authorization") === `Bearer ${env.cronSecret}`;

/** Queue status (internal, cron secret). */
export async function GET(req: Request) {
  if (!auth(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json({ handlers: registeredHandlers(), queue: env.redisUrl ? "bullmq" : await queueStats() });
}

/** Enqueue a job ({ name, payload, tenantId?, runAt? }) or drain the queue ({ process: n }). */
export async function POST(req: Request) {
  if (!auth(req)) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const drain = z.object({ process: z.number().int().min(1).max(200) }).safeParse(body);
  if (drain.success) return Response.json(await processJobs(drain.data.process));
  const parsed = z.object({ name: z.string().refine((n) => registeredHandlers().includes(n), "Trabajo desconocido"), payload: z.record(z.string(), z.unknown()).default({}), tenantId: z.string().nullable().optional(), runAt: z.coerce.date().optional() }).safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Petición no válida" }, { status: 400 });
  return Response.json(await enqueue(parsed.data.name, parsed.data.payload, { tenantId: parsed.data.tenantId ?? null, runAt: parsed.data.runAt }), { status: 201 });
}
