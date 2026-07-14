/**
 * Parse pagination from query. Every list endpoint applies a limit so we never
 * run an unbounded find(). Defaults to a generous cap (so the current
 * non-paginated frontend keeps working) but honors ?page & ?limit.
 */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export interface Paging {
  page: number;
  limit: number;
  skip: number;
}

export function getPaging(query: Record<string, any>): Paging {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const rawLimit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit };
}
