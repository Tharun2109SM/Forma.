export type AppSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

export function pageParam(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

export function pageHref(path: string, params: Record<string, string>, page: number) {
  const query = new URLSearchParams(params);
  query.set("page", String(page));
  return `${path}?${query.toString()}`;
}

export function redirectQuery(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.append(key, value);
    else if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
  }
  return query.size ? `?${query.toString()}` : "";
}
