import { env } from "@/lib/env";
import { processJobs, queueStats } from "@/lib/jobs";
import "@/lib/jobs/handlers";
import { runScheduledWorkflows } from "@/server/workflows";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (daily on Hobby, see vercel.json; any external scheduler can call it more often): drains the Postgres job queue
 * and runs due scheduled workflows for every tenant.
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return Response.json({ error: "No autorizado" }, { status: 401 });
  const started = Date.now();
  const workflows = await runScheduledWorkflows();
  const jobs = env.redisUrl ? { done: 0, failed: 0, driver: "bullmq (lo procesa pnpm worker)" } : await processJobs(50);
  return Response.json({ ok: true, workflows, jobs, queue: env.redisUrl ? null : await queueStats(), ms: Date.now() - started });
}
