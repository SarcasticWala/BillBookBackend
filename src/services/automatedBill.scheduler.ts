import { defineJob, getAgenda } from "../config/scheduler";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { runDueTemplates } from "./automatedBill.service";

// Safe at module load time — defineJob only registers a handler, it doesn't
// touch the database (see scheduler.ts).
defineJob("automated-bills:tick", async () => {
  await runDueTemplates();
});

/**
 * Schedules the recurring tick. A no-op unless FEATURE_AUTOMATED_BILLS is
 * on — call only after startScheduler() (FEATURE_SCHEDULER) has run.
 */
export async function scheduleAutomatedBillsTick(): Promise<void> {
  if (!env.flags.automatedBills) return;
  await getAgenda().every("1 hour", "automated-bills:tick");
  logger.info("[automated-bills] recurring tick scheduled");
}
