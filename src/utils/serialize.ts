/**
 * The frontend reads `.id` on entities (category.id, party.id, item.id), but
 * `.lean()` results only carry `_id`. These helpers add a string `id` field
 * while keeping `_id`, so lean reads stay fast and the client contract holds.
 */
type WithMaybeId = { _id?: unknown } & Record<string, any>;

export function withId<T extends WithMaybeId>(doc: T | null): (T & { id: string }) | null {
  if (!doc) return null;
  const idValue = doc._id != null ? String(doc._id) : "";
  return { ...doc, id: idValue };
}

export function withIds<T extends WithMaybeId>(docs: T[]): Array<T & { id: string }> {
  return docs.map((d) => withId(d)!) as Array<T & { id: string }>;
}
