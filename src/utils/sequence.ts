import { Types } from "mongoose";
import { Counter } from "../models/Counter";

/**
 * Atomically issues the next number in a per-user series, formatted as
 * "<prefix>-000123". The atomic $inc means concurrent requests (e.g. two
 * POS checkouts at once) can never receive the same number.
 */
export async function nextSequence(
  userId: Types.ObjectId,
  series: string,
  prefix: string
): Promise<string> {
  const doc = await Counter.findOneAndUpdate(
    { user: userId, series },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `${prefix}-${String(doc!.seq).padStart(6, "0")}`;
}
