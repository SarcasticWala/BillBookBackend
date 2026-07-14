import { Tax } from "../models/Tax";
import { Unit } from "../models/Unit";
import { Location } from "../models/Location";
import { cached } from "../utils/cache";

// Global reference data changes rarely -> cache it (1h TTL).

export function getTaxes() {
  return cached("taxes", async () => {
    const taxes = await Tax.find().sort({ rate: 1 }).lean();
    // Frontend renders `GST @ {tax.value}%` and uses value as the option value.
    return taxes.map((t) => ({
      id: String(t._id),
      _id: String(t._id),
      name: t.name,
      rate: t.rate,
      value: t.rate,
      label: t.name,
    }));
  });
}

export function getUnits() {
  return cached("units", async () => {
    const units = await Unit.find().sort({ name: 1 }).lean();
    return units.map((u) => ({
      id: String(u._id),
      name: u.name,
      shortName: u.shortName,
      value: u.shortName,
      label: `${u.name} - ${u.shortName}`,
    }));
  });
}

export function getLocations() {
  return cached("locations", async () => {
    const rows = await Location.find().sort({ state: 1, city: 1 }).lean();
    const stateSet = new Map<string, { state: string; stateCode: string }>();
    const cities: Array<{ city: string; state: string }> = [];
    for (const r of rows) {
      if (!stateSet.has(r.state)) {
        stateSet.set(r.state, { state: r.state, stateCode: r.stateCode || "" });
      }
      if (r.city) cities.push({ city: r.city, state: r.state });
    }
    return { states: [...stateSet.values()], cities };
  });
}
