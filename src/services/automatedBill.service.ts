import { Types } from "mongoose";
import { AutomatedBillTemplate, AutomatedBillTemplateDoc } from "../models/AutomatedBillTemplate";
import { AutomatedBillRun } from "../models/AutomatedBillRun";
import { Party } from "../models/Party";
import { ApiError } from "../utils/ApiError";
import { withId, withIds } from "../utils/serialize";
import { nextSequence } from "../utils/sequence";
import { computePeriodKey, addInterval, BillFrequency } from "../utils/recurrence";
import { createSale } from "./sale.service";
import { logger } from "../config/logger";

function invoicePayload(tmpl: {
  partyId: Types.ObjectId;
  itemDetails: any[];
  additionalCharges: number;
  discountAfterTax: number;
  notes: string;
  termsAndConditions: string;
}) {
  return {
    partyId: String(tmpl.partyId),
    itemDetails: tmpl.itemDetails,
    additionalCharges: tmpl.additionalCharges,
    discountAfterTax: tmpl.discountAfterTax,
    notes: tmpl.notes,
    termsAndConditions: tmpl.termsAndConditions,
    channel: "AUTOMATED_BILL",
  };
}

// ---- Templates (AB-BR-01, AB-BR-02, AB-BR-06) ----

export async function createTemplate(userId: Types.ObjectId, body: Record<string, any>) {
  const rows = Array.isArray(body.itemDetails) ? body.itemDetails : [];
  if (!body.partyId) throw new ApiError(400, "partyId is required");
  if (!rows.length) throw new ApiError(400, "At least one item is required");
  if (!body.frequency) throw new ApiError(400, "frequency is required");
  if (!body.startDate) throw new ApiError(400, "startDate is required");

  const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");

  const startDate = new Date(body.startDate);
  const template = await AutomatedBillTemplate.create({
    user: userId,
    partyId: party._id,
    partyName: party.partyName,
    itemDetails: rows,
    additionalCharges: Number(body.additionalCharges) || 0,
    discountAfterTax: Number(body.discountAfterTax) || 0,
    notes: body.notes || "",
    termsAndConditions: body.termsAndConditions || "",
    frequency: body.frequency,
    startDate,
    endDate: body.endDate ? new Date(body.endDate) : null,
    occurrenceCount: body.occurrenceCount ? Number(body.occurrenceCount) : null,
    autoPost: Boolean(body.autoPost),
    nextRunDate: startDate,
    status: "ACTIVE",
  });

  return withId(template.toObject());
}

export async function listTemplates(userId: Types.ObjectId) {
  const templates = await AutomatedBillTemplate.find({ user: userId })
    .sort({ createdAt: -1 })
    .lean();
  return withIds(templates);
}

export async function getTemplate(userId: Types.ObjectId, id: string) {
  const template = await AutomatedBillTemplate.findOne({ _id: id, user: userId }).lean();
  if (!template) throw new ApiError(404, "Template not found");
  return withId(template);
}

export async function updateTemplate(
  userId: Types.ObjectId,
  id: string,
  body: Record<string, any>
) {
  const template = await AutomatedBillTemplate.findOne({ _id: id, user: userId });
  if (!template) throw new ApiError(404, "Template not found");
  if (template.status === "CANCELLED")
    throw new ApiError(400, "A cancelled template cannot be edited");

  if (body.partyId) {
    const party = await Party.findOne({ _id: body.partyId, user: userId }).lean();
    if (!party) throw new ApiError(404, "Party not found");
    template.partyId = party._id;
    template.partyName = party.partyName;
  }
  if (Array.isArray(body.itemDetails) && body.itemDetails.length) {
    template.itemDetails = body.itemDetails;
  }
  if (body.additionalCharges != null) template.additionalCharges = Number(body.additionalCharges) || 0;
  if (body.discountAfterTax != null) template.discountAfterTax = Number(body.discountAfterTax) || 0;
  if (body.notes != null) template.notes = body.notes;
  if (body.termsAndConditions != null) template.termsAndConditions = body.termsAndConditions;
  if (body.autoPost != null) template.autoPost = Boolean(body.autoPost);
  if (body.endDate !== undefined) template.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.occurrenceCount !== undefined) {
    template.occurrenceCount = body.occurrenceCount ? Number(body.occurrenceCount) : null;
  }
  // Changing frequency/startDate only makes sense before the schedule has
  // actually started running — otherwise it'd silently reshuffle history.
  if (template.occurrencesGenerated === 0) {
    if (body.frequency) template.frequency = body.frequency;
    if (body.startDate) {
      template.startDate = new Date(body.startDate);
      template.nextRunDate = template.startDate;
    }
  }

  await template.save();
  return withId(template.toObject());
}

export async function pauseTemplate(userId: Types.ObjectId, id: string) {
  const template = await AutomatedBillTemplate.findOne({ _id: id, user: userId });
  if (!template) throw new ApiError(404, "Template not found");
  if (template.status !== "ACTIVE") throw new ApiError(400, "Only an active template can be paused");
  template.status = "PAUSED";
  await template.save();
  return withId(template.toObject());
}

export async function resumeTemplate(userId: Types.ObjectId, id: string) {
  const template = await AutomatedBillTemplate.findOne({ _id: id, user: userId });
  if (!template) throw new ApiError(404, "Template not found");
  if (template.status !== "PAUSED") throw new ApiError(400, "Only a paused template can be resumed");
  // Don't backfill periods missed while paused — resume from now, not from
  // whatever stale nextRunDate accrued during the pause.
  const now = new Date();
  if (template.nextRunDate < now) template.nextRunDate = now;
  template.status = "ACTIVE";
  await template.save();
  return withId(template.toObject());
}

export async function cancelTemplate(userId: Types.ObjectId, id: string) {
  const template = await AutomatedBillTemplate.findOne({ _id: id, user: userId });
  if (!template) throw new ApiError(404, "Template not found");
  template.status = "CANCELLED";
  await template.save();
  return withId(template.toObject());
}

// ---- Runs (AB-BR-07 history, AB-BR-08 retry) ----

export async function listRuns(userId: Types.ObjectId, templateId?: string) {
  const filter: Record<string, any> = { user: userId };
  if (templateId) filter.template = templateId;
  const runs = await AutomatedBillRun.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return withIds(runs);
}

/** Manually post a PENDING_REVIEW run — turns its snapshot into a real invoice. */
export async function postRun(userId: Types.ObjectId, runId: string) {
  const run = await AutomatedBillRun.findOne({ _id: runId, user: userId });
  if (!run) throw new ApiError(404, "Run not found");
  if (run.status !== "PENDING_REVIEW")
    throw new ApiError(400, `Run is already ${run.status.toLowerCase()}`);

  const invioceNo = await nextSequence(userId, "AB", "AB");
  const invoice = await createSale(userId, { ...run.snapshot, invioceNo });
  if (!invoice) throw new ApiError(500, "Failed to create invoice");

  run.status = "POSTED";
  run.invoiceId = invoice._id;
  run.postedAt = new Date();
  run.snapshot = null;
  await run.save();
  return withId(run.toObject());
}

export async function cancelRun(userId: Types.ObjectId, runId: string) {
  const run = await AutomatedBillRun.findOne({ _id: runId, user: userId });
  if (!run) throw new ApiError(404, "Run not found");
  if (run.status !== "PENDING_REVIEW")
    throw new ApiError(400, `Run is already ${run.status.toLowerCase()}`);
  run.status = "CANCELLED";
  run.snapshot = null;
  await run.save();
  return withId(run.toObject());
}

/** Re-attempt a FAILED run — updates the same row in place, so it can never consume a second period/invoice number. */
export async function retryRun(userId: Types.ObjectId, runId: string) {
  const run = await AutomatedBillRun.findOne({ _id: runId, user: userId });
  if (!run) throw new ApiError(404, "Run not found");
  if (run.status !== "FAILED") throw new ApiError(400, "Only a failed run can be retried");

  const template = await AutomatedBillTemplate.findOne({ _id: run.template, user: userId });
  if (!template) throw new ApiError(404, "Template not found");

  await settleRun(run, template);
  return withId(run.toObject());
}

// ---- Generation (AB-Bo1, AB-Bo2 — the critical exactly-once path) ----

async function settleRun(run: InstanceType<typeof AutomatedBillRun>, template: AutomatedBillTemplateDoc) {
  try {
    if (template.autoPost) {
      const invioceNo = await nextSequence(template.user as Types.ObjectId, "AB", "AB");
      const invoice = await createSale(template.user as Types.ObjectId, {
        ...invoicePayload(template),
        invioceNo,
      });
      if (!invoice) throw new Error("Failed to create invoice");
      run.status = "POSTED";
      run.invoiceId = invoice._id;
      run.postedAt = new Date();
      run.snapshot = null;
      run.error = "";
    } else {
      run.status = "PENDING_REVIEW";
      run.snapshot = invoicePayload(template);
      run.error = "";
    }
  } catch (err: any) {
    run.status = "FAILED";
    run.error = err?.message || "Generation failed";
  }
  await run.save();
}

async function advanceTemplate(template: InstanceType<typeof AutomatedBillTemplate>) {
  template.occurrencesGenerated += 1;
  template.lastRunAt = new Date();
  const next = addInterval(template.nextRunDate, template.frequency as BillFrequency);

  const pastEndDate = !!template.endDate && next > template.endDate;
  const reachedCount =
    !!template.occurrenceCount && template.occurrencesGenerated >= template.occurrenceCount;

  if (pastEndDate || reachedCount) {
    template.status = "COMPLETED";
  } else {
    template.nextRunDate = next;
  }
  await template.save();
}

/** One template, one due period. Called by the scheduler tick (and safe to call redundantly — see the unique index note on AutomatedBillRun). */
async function generateForTemplate(template: InstanceType<typeof AutomatedBillTemplate>) {
  const period = computePeriodKey(template.frequency as BillFrequency, template.nextRunDate);

  let run;
  try {
    run = await AutomatedBillRun.create({
      user: template.user,
      template: template._id,
      period,
      status: "PENDING_REVIEW",
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      // This period was already generated (a duplicate tick or a retried
      // job) — don't generate again, just move the schedule forward.
      await advanceTemplate(template);
      return;
    }
    throw err;
  }

  await settleRun(run, template);
  await advanceTemplate(template);
}

/** The scheduler tick: every template due now gets exactly one generation attempt. */
export async function runDueTemplates(): Promise<void> {
  const due = await AutomatedBillTemplate.find({
    status: "ACTIVE",
    nextRunDate: { $lte: new Date() },
  });
  for (const template of due) {
    try {
      await generateForTemplate(template);
    } catch (err) {
      logger.error({ err, templateId: template._id }, "[automated-bills] generation failed");
    }
  }
}
