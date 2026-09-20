import { defineJob, getAgenda } from "../config/scheduler";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { runEInvoiceSweep } from "./eInvoice.service";

// Safe at module load time — see automatedBill.scheduler.ts for the same pattern.
defineJob("einvoice:sweep", async () => {
  await runEInvoiceSweep();
});

/** No-op unless FEATURE_E_INVOICING is on. This is how "deferred IRN on IRP
 * downtime" works: a FAILED submission just gets picked up on the next sweep. */
export async function scheduleEInvoiceSweep(): Promise<void> {
  if (!env.flags.eInvoicing) return;
  await getAgenda().every("15 minutes", "einvoice:sweep");
  logger.info("[e-invoice] recurring sweep scheduled");
}
