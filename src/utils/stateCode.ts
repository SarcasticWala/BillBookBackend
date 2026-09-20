import { Location } from "../models/Location";

/** Resolves a state name (as stored on User/Party) to its 2-digit GST state code. */
export async function getStateCode(stateName: string): Promise<string | null> {
  const name = String(stateName || "").trim();
  if (!name) return null;
  const row = await Location.findOne({ state: name }, { stateCode: 1 }).lean();
  return row?.stateCode ?? null;
}
