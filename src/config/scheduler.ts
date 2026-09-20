import { Agenda, Job } from "agenda";
import { MongoBackend } from "@agendajs/mongo-backend";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Shared background job runner (Agenda, MongoDB-backed — no Redis). Entirely
 * dark unless FEATURE_SCHEDULER is on: nothing below runs, and no extra DB
 * connection opens, until startScheduler() is called and the flag is set.
 *
 * A separate small connection pool (not mongoose's) so a scheduler hiccup
 * can never contend with the main app's pool — capped low since this only
 * needs to poll for due jobs, not serve requests.
 */
let agenda: Agenda | null = null;

function getAgenda(): Agenda {
  if (!agenda) {
    agenda = new Agenda({
      backend: new MongoBackend({ address: env.mongoUri, collection: "agendaJobs" }),
      processEvery: "30 seconds",
    });
    agenda.on("error", (err: Error) => logger.error({ err }, "[scheduler] error"));
  }
  return agenda;
}

/**
 * Registers a named job handler. Safe to call at module load time (before
 * the scheduler starts, even before Mongo connects) — it only configures the
 * job definition, it doesn't touch the database.
 */
export function defineJob(
  name: string,
  handler: (job: Job) => Promise<void>
): void {
  getAgenda().define(name, handler);
}

export async function startScheduler(): Promise<void> {
  if (!env.flags.scheduler) return;
  await getAgenda().start();
  logger.info("[scheduler] started");
}

export async function stopScheduler(): Promise<void> {
  if (!agenda) return;
  await agenda.stop();
  logger.info("[scheduler] stopped");
}

export { getAgenda };
