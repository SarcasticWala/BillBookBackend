import { Types } from "mongoose";
import { Party } from "../models/Party";
import { PartyCategory } from "../models/PartyCategory";
import { ApiError } from "../utils/ApiError";
import { parseSheet, buildErrorWorkbook } from "../utils/excel";
import { getPaging } from "../utils/pagination";
import { withId, withIds } from "../utils/serialize";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function signedOpening(amount: number, type: string): number {
  return type === "TO_PAY" ? -Math.abs(amount) : Math.abs(amount);
}

export async function createParty(userId: Types.ObjectId, body: Record<string, any>) {
  if (!body.partyName) throw new ApiError(400, "Party name is required");
  const opening = num(body.openingBalance);
  const party = await Party.create({
    ...body,
    user: userId,
    openingBalance: opening,
    balance: signedOpening(opening, body.openingBalanceType || "TO_COLLECT"),
  });
  return withId(party.toObject());
}

export async function updateParty(
  userId: Types.ObjectId,
  id: string,
  body: Record<string, any>
) {
  const { user, _id, id: _ignore, ...rest } = body;
  const party = await Party.findOneAndUpdate({ _id: id, user: userId }, rest, {
    new: true,
  }).lean();
  if (!party) throw new ApiError(404, "Party not found");
  return withId(party);
}

export async function listParties(userId: Types.ObjectId, query: Record<string, any>) {
  const { limit, skip } = getPaging(query);
  const parties = await Party.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  return withIds(parties);
}

export async function listPartiesPaged(
  userId: Types.ObjectId,
  query: Record<string, any>
) {
  const { page, limit, skip } = getPaging(query);
  const filter: Record<string, any> = { user: userId };
  const search = String(query.search || "").trim();
  if (search) {
    filter.$or = [
      { partyName: { $regex: search, $options: "i" } },
      { mobileNo: { $regex: search, $options: "i" } },
    ];
  }
  if (query.partyType) filter.partyType = query.partyType;
  const cats = String(query.categories || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (cats.length) filter.partyCatagory = { $in: cats };

  const [parties, total, statsAgg] = await Promise.all([
    Party.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Party.countDocuments(filter),
    // Stats reflect ALL of the user's parties (independent of the filter),
    // matching the Parties summary cards.
    Party.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          toCollect: {
            $sum: { $cond: [{ $gt: ["$balance", 0] }, "$balance", 0] },
          },
          toPay: {
            $sum: { $cond: [{ $lt: ["$balance", 0] }, { $abs: "$balance" }, 0] },
          },
        },
      },
    ]),
  ]);

  const s = statsAgg[0] || {};
  return {
    items: withIds(parties),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats: { count: s.count || 0, toCollect: s.toCollect || 0, toPay: s.toPay || 0 },
  };
}

export async function getParty(userId: Types.ObjectId, id: string) {
  const party = await Party.findOne({ _id: id, user: userId }).lean();
  if (!party) throw new ApiError(404, "Party not found");
  return withId(party);
}

export async function createCategory(userId: Types.ObjectId, name: string) {
  const trimmed = String(name).trim();
  // Shared category store (used by both Parties and Items). Reuse if the name
  // already exists rather than failing on the unique (user, name) index.
  let cat = await PartyCategory.findOne({ user: userId, name: trimmed });
  if (!cat) {
    try {
      cat = await PartyCategory.create({ user: userId, name: trimmed });
    } catch (err: any) {
      if (err?.code === 11000) cat = await PartyCategory.findOne({ user: userId, name: trimmed });
      else throw err;
    }
  }
  return {
    id: String(cat!._id),
    _id: String(cat!._id),
    name: cat!.name,
    value: String(cat!._id),
    label: cat!.name,
  };
}

export async function listCategories(userId: Types.ObjectId) {
  const cats = await PartyCategory.find({ user: userId }).sort({ name: 1 }).lean();
  return cats.map((c) => ({
    id: String(c._id),
    _id: String(c._id),
    name: c.name,
    value: String(c._id),
    label: c.name,
  }));
}

export async function bulkCreate(
  userId: Types.ObjectId,
  fileBuffer: Buffer
): Promise<{ ok: true; count: number } | { ok: false; errorFile: Buffer }> {
  const rows = parseSheet<Record<string, any>>(fileBuffer);
  if (!rows.length) throw new ApiError(400, "Excel file has no rows");

  const valid: any[] = [];
  const errors: Array<Record<string, any> & { Error: string }> = [];

  for (const row of rows) {
    const partyName = String(row.Name ?? row.name ?? row.PartyName ?? "").trim();
    if (!partyName) {
      errors.push({ ...row, Error: "Name is required" });
      continue;
    }
    const opening = num(row.OpeningBalance ?? row.openingBalance);
    const type = String(row.BalanceType ?? "TO_COLLECT").toUpperCase();
    valid.push({
      user: userId,
      partyName,
      mobileNo: String(row.Mobile ?? row.mobileNo ?? ""),
      email: String(row.Email ?? row.email ?? ""),
      gstNumber: String(row.GSTIN ?? row.gstNumber ?? ""),
      partyType: String(row.PartyType ?? "CUSTOMER").toUpperCase(),
      openingBalance: opening,
      openingBalanceType: type,
      balance: signedOpening(opening, type),
    });
  }

  if (errors.length) return { ok: false, errorFile: buildErrorWorkbook(errors) };
  const created = await Party.insertMany(valid);
  return { ok: true, count: created.length };
}
