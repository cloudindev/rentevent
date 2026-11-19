/**
 * Background worker: `pnpm worker`.
 * - With REDIS_URL: BullMQ worker on the "rentevent" queue.
 * - Without: polls the Postgres `jobs` table every 5 s and runs due
 *   scheduled workflows every minute.
 * Server modules guard against client import with "server-only", so the worker
 * re-executes itself under the `react-server` export condition.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

if (!process.execArgv.some((a) => a.includes("react-server")) && !process.env.RV_WORKER_CHILD) {
  const child = spawn(process.execPath, [...process.execArgv, "--conditions=react-server", fileURLToPath(import.meta.url)], { stdio: "inherit", env: { ...process.env, RV_WORKER_CHILD: "1" } });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const { config } = await import("dotenv");
  config({ path: new URL("../.env.local", import.meta.url).pathname, quiet: true });
  const { env } = await import("../src/lib/env");
  const jobs = await import("../src/lib/jobs");
  await import("../src/lib/jobs/handlers");
  const { runScheduledWorkflows } = await import("../src/server/workflows");
  let stopping = false;
  const stop = () => {
    stopping = true;
    console.log("Deteniendo el worker…");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  if (env.redisUrl) {
    const { Worker } = await import("bullmq");
    const url = new URL(env.redisUrl);
    const worker = new Worker(
      jobs.QUEUE_NAME,
      async (job) => jobs.executeJob(job.name, (job.data?.payload ?? {}) as Record<string, unknown>, { tenantId: job.data?.tenantId ?? null, attempts: job.attemptsMade + 1 }),
      { connection: { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined, username: url.username || undefined, tls: url.protocol === "rediss:" ? {} : undefined }, concurrency: 4 },
    );
    worker.on("failed", (job, err) => console.error(`Trabajo ${job?.name} falló: ${err.message}`));
    console.log("Worker BullMQ escuchando la cola «rentevent»");
    setInterval(() => void runScheduledWorkflows().catch((e) => console.error(e)), 60_000);
    process.on("SIGTERM", () => void worker.close().then(() => process.exit(0)));
    process.on("SIGINT", () => void worker.close().then(() => process.exit(0)));
  } else {
    console.log("Worker con cola en PostgreSQL (sondeo cada 5 s)");
    let lastSchedule = 0;
    while (!stopping) {
      try {
        const r = await jobs.processJobs(20);
        if (r.done || r.failed) console.log(`Trabajos: ${r.done} hechos, ${r.failed} con error`);
        if (Date.now() - lastSchedule > 60_000) {
          lastSchedule = Date.now();
          const s = await runScheduledWorkflows();
          if (s.runs) console.log(`Workflows programados ejecutados: ${s.runs}`);
        }
      } catch (e) {
        console.error(e);
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
    process.exit(0);
  }
}
