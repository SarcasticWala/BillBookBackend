/**
 * Seed global reference data: GST tax rates, units, and Indian state/city
 * locations. Run with:  npm run seed
 */
import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { Tax } from "./models/Tax";
import { Unit } from "./models/Unit";
import { Location } from "./models/Location";
import { logger } from "./config/logger";

const TAXES = [
  { name: "GST 0%", rate: 0 },
  { name: "GST 5%", rate: 5 },
  { name: "GST 12%", rate: 12 },
  { name: "GST 18%", rate: 18 },
  { name: "GST 28%", rate: 28 },
];

const UNITS = [
  { name: "Pieces", shortName: "PCS" },
  { name: "Kilograms", shortName: "KG" },
  { name: "Grams", shortName: "GM" },
  { name: "Litres", shortName: "LTR" },
  { name: "Metres", shortName: "MTR" },
  { name: "Box", shortName: "BOX" },
  { name: "Dozen", shortName: "DZN" },
  { name: "Bags", shortName: "BAG" },
];

// state -> [stateCode, major cities]. Expand as needed.
const STATE_CITIES: Record<string, [string, string[]]> = {
  "Andhra Pradesh": ["37", ["Visakhapatnam", "Vijayawada", "Guntur"]],
  Assam: ["18", ["Guwahati", "Dibrugarh", "Silchar"]],
  Bihar: ["10", ["Patna", "Gaya", "Bhagalpur"]],
  Chhattisgarh: ["22", ["Raipur", "Bhilai", "Bilaspur"]],
  Delhi: ["07", ["New Delhi", "Dwarka", "Rohini"]],
  Goa: ["30", ["Panaji", "Margao", "Vasco da Gama"]],
  Gujarat: ["24", ["Ahmedabad", "Surat", "Vadodara", "Rajkot"]],
  Haryana: ["06", ["Gurugram", "Faridabad", "Panipat"]],
  "Himachal Pradesh": ["02", ["Shimla", "Solan", "Mandi"]],
  Jharkhand: ["20", ["Ranchi", "Jamshedpur", "Dhanbad"]],
  Karnataka: ["29", ["Bengaluru", "Mysuru", "Mangaluru", "Hubli"]],
  Kerala: ["32", ["Kochi", "Thiruvananthapuram", "Kozhikode"]],
  "Madhya Pradesh": ["23", ["Bhopal", "Indore", "Jabalpur", "Gwalior"]],
  Maharashtra: ["27", ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane"]],
  Odisha: ["21", ["Bhubaneswar", "Cuttack", "Rourkela"]],
  Punjab: ["03", ["Ludhiana", "Amritsar", "Jalandhar"]],
  Rajasthan: ["08", ["Jaipur", "Jodhpur", "Udaipur", "Kota"]],
  "Tamil Nadu": ["33", ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"]],
  Telangana: ["36", ["Hyderabad", "Warangal", "Nizamabad"]],
  "Uttar Pradesh": ["09", ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Varanasi"]],
  Uttarakhand: ["05", ["Dehradun", "Haridwar", "Nainital"]],
  "West Bengal": ["19", ["Kolkata", "Howrah", "Siliguri", "Durgapur"]],
};

async function seed() {
  await connectDB();

  for (const t of TAXES) {
    await Tax.updateOne({ name: t.name }, { $set: t }, { upsert: true });
  }
  for (const u of UNITS) {
    await Unit.updateOne({ shortName: u.shortName }, { $set: u }, { upsert: true });
  }

  let cityCount = 0;
  for (const [state, [stateCode, cities]] of Object.entries(STATE_CITIES)) {
    // A state-only row (city: "") guarantees the state appears even with no cities.
    await Location.updateOne(
      { state, city: "" },
      { $set: { state, city: "", stateCode } },
      { upsert: true }
    );
    for (const city of cities) {
      await Location.updateOne(
        { state, city },
        { $set: { state, city, stateCode } },
        { upsert: true }
      );
      cityCount++;
    }
  }

  logger.info(
    `Seed done: ${TAXES.length} taxes, ${UNITS.length} units, ${
      Object.keys(STATE_CITIES).length
    } states, ${cityCount} cities`
  );
  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
