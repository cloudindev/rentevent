import "server-only";
import { jobs, sql, systemDb } from "@rentevent/db";
import { env } from "../env";

export type JobPayload = Record<string, unknown>;
export type JobHandler = (payload: JobPayload, meta: { tenantId: string | null; attempts: number }) => Promise<unknown>;

const g = globalThis as unknown as { __rv_job_handlers?: Map<string, JobHandler> };
const handlers: Map<string, JobHandler> = (g.__rv_job_handlers ??= new Map());

export const MAX_ATTEMPTS = 5;
export const QUEUE_NAME = "rentevent";

export function registerHandler(name: string, fn: JobHandler) {
  handlers.set(name, fn);
}
export const registeredHandlers = () => [...handlers.keys()];

/** Exponential backoff: 30 s, 2 min, 8 min, 32 min. */
export const backoffMs = (attempts: number) => 30_000 * 4 ** Math.max(0, attempts - 1);

let bullQueue: import("bullmq").Queue | null = null;
async function bull() {
  if (!bullQueue) {
    const { Queue } = await import("bullmq");
    const url = new URL(env.redisUrl!);
    bullQueue = new Queue(QUEUE_NAME, {
      connection: { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined, username: url.username || undefined, tls: url.protocol === "rediss:" ? {} : undefined },
    });
  }
  return bullQueue;
}

/**
 * Enqueues a background job. With REDIS_URL it goes to BullMQ (processed by
 * `pnpm worker`); otherwise to the `jobs` table, drained by `pnpm worker` or by
 * the `/api/cron` endpoint (Vercel Cron).
 */
export async function enqueue(name: string, payload: JobPayload = {}, opts: { runAt?: Date; tenantId?: string | null } = {}) {
  if (env.redisUrl) {
    const q = await bull();
    const job = await q.add(name, { payload, tenantId: opts.tenantId ?? null }, { delay: opts.runAt ? Math.max(0, opts.runAt.getTime() - Date.now()) : 0, attempts: MAX_ATTEMPTS, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: 500, removeOnFail: 1000 });
    return { id: String(job.id), driver: "bullmq" as const };
  }
  const [row] = await systemDb()
    .insert(jobs)
    .values({ name, payload, tenantId: opts.tenantId ?? null, runAt: opts.runAt ?? new Date() })
    .returning({ id: jobs.id });
  return { id: row!.id, driver: "postgres" as const };
}

/** Runs one job through its handler (used by both drivers). */
export async function executeJob(name: string, payload: JobPayload, meta: { tenantId: string | null; attempts: number }) {
  const fn = handlers.get(name);
  if (!fn) throw new Error(`No hay manejador para el trabajo "${name}"`);
  return fn(payload, meta);
}

/** Claims and runs up to `limit` due jobs from the Postgres queue (FOR UPDATE SKIP LOCKED). */
export async function processJobs(limit = 20): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (let i = 0; i < limit; i++) {
    const claimed = await systemDb().execute<{ id: string; name: string; payload: JobPayload; tenant_id: string | null; attempts: number }>(sql`
      update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
      where id = (
        select id from jobs
        where (status = 'pending' and run_at <= now())
           or (status = 'running' and locked_at < now() - interval '10 minutes')
        order by run_at
        for update skip locked
        limit 1
      )
      returning id, name, payload, tenant_id, attempts`);
    const job = claimed.rows[0];
    if (!job) break;
    try {
      const result = await executeJob(job.name, job.payload ?? {}, { tenantId: job.tenant_id, attempts: job.attempts });
      await systemDb().execute(sql`update jobs set status = 'done', result = ${JSON.stringify(result ?? null)}::jsonb, last_error = null where id = ${job.id}`);
      done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const dead = job.attempts >= MAX_ATTEMPTS;
      await systemDb().execute(sql`
        update jobs set status = ${dead ? "failed" : "pending"}, last_error = ${msg.slice(0, 2000)},
          run_at = now() + (${backoffMs(job.attempts)} || ' milliseconds')::interval, locked_at = null
        where id = ${job.id}`);
      failed++;
    }
  }
  return { done, failed };
}

export async function queueStats() {
  const rows = await systemDb().execute<{ status: string; n: number }>(sql`select status, count(*)::int as n from jobs group by status`);
  return Object.fromEntries(rows.rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
}
