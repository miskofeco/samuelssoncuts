// Supabase's Data API caps returned rows (1,000 by default). Always advance by
// the number actually returned: a project can configure a lower cap than our
// requested range. Stable, unique ordering is the caller's responsibility.
const PAGE_SIZE = 500;
const MAX_PAGE_REQUESTS = 500;

type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function readAllPages<T>(
  label: string,
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let request = 0; request < MAX_PAGE_REQUESTS; request += 1) {
    const from = rows.length;
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    if (!data?.length) return rows;
    rows.push(...data);
  }

  // Never present a silently incomplete list or metric if the shop grows past
  // a practical request budget. The caller can add a server-side aggregate or
  // user-facing pagination for a genuinely large dataset.
  throw new Error(`${label}: pagination request limit exceeded`);
}
