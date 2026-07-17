import { Types } from "mongoose";
import { DemoRequest } from "../models/DemoRequest";
import { ApiError } from "../utils/ApiError";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";

export async function bookDemo(userId: Types.ObjectId, body: Record<string, any>) {
  if (!body.name) throw new ApiError(400, "Name is required");
  if (!body.mobileNo) throw new ApiError(400, "Mobile number is required");

  // One active demo at a time: block a new request while an existing one is
  // still PENDING or SCHEDULED (prevents duplicate / spam bookings).
  const active = await DemoRequest.findOne({
    user: userId,
    status: { $in: ["PENDING", "SCHEDULED"] },
  }).lean();
  if (active) {
    throw new ApiError(
      409,
      "You already have a demo request in progress. We'll reach out soon."
    );
  }

  const demo = await DemoRequest.create({
    user: userId,
    name: body.name,
    email: body.email || "",
    mobileNo: body.mobileNo,
    businessName: body.businessName || "",
    interest: String(body.interest || "BILLING").toUpperCase(),
    preferredDate: body.preferredDate || "",
    preferredTime: body.preferredTime || "",
    attendees: Number(body.attendees) > 0 ? Number(body.attendees) : 1,
    message: body.message || "",
  });
  return withId(demo.toObject());
}

export async function listDemos(userId: Types.ObjectId, query: Record<string, any>) {
  const { limit, skip } = getPaging(query);
  const demos = await DemoRequest.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  return withIds(demos);
}

const VALID_STATUSES = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;

/** Admin: every demo request across all users, with the requester's profile. */
export async function listAllDemos(query: Record<string, any>) {
  const { limit, skip } = getPaging(query);
  const demos = await DemoRequest.find({})
    .populate("user", "name phone businessName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  return withIds(demos);
}

/** Admin: move a demo request to a new status. */
export async function updateStatus(id: string, status: string) {
  const next = String(status).toUpperCase();
  if (!VALID_STATUSES.includes(next as (typeof VALID_STATUSES)[number])) {
    throw new ApiError(400, "Invalid status");
  }
  const demo = await DemoRequest.findByIdAndUpdate(
    id,
    { status: next },
    { new: true }
  )
    .populate("user", "name phone businessName")
    .lean();
  if (!demo) throw new ApiError(404, "Demo request not found");
  return withId(demo);
}
