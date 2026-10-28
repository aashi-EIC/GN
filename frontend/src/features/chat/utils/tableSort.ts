const naturalOrder = new Intl.Collator(undefined, { numeric: true });

export function toTableNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.trim().replace(/,/g, "").replace(/%$/, "");
  return normalized ? Number(normalized) : Number.NaN;
}

export function sortTableRows<T extends Record<string, unknown>>(
  rows: T[],
  key: string,
  direction: "asc" | "desc",
): T[] {
  const order = direction === "asc" ? 1 : -1;
  return rows
    .map((row) => ({ row, number: toTableNumber(row[key]), text: String(row[key] ?? "") }))
    .sort((left, right) => {
      const comparison =
        !Number.isNaN(left.number) && !Number.isNaN(right.number)
          ? left.number - right.number
          : naturalOrder.compare(left.text, right.text);
      return comparison * order;
    })
    .map(({ row }) => row);
}
