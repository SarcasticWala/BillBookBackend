import NodeCache from "node-cache";

// In-memory cache for rarely-changing global reference data (taxes, units,
// locations). TTL 1h; survives per-request, not restarts. Swap for Redis if
// the app scales to multiple instances.
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  cache.set(key, value);
  return value;
}

export function invalidate(key: string): void {
  cache.del(key);
}
