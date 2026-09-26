export function pageRows<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const safePage = Math.min(page, pages)
  return { rows: rows.slice((safePage - 1) * size, safePage * size), page: safePage, pages }
}
