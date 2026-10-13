const MAX_DAX_QUERY_LENGTH = 500_000;
const MAX_DAX_QUERIES = 100;

/** Normalize MCP transport shapes without rewriting the DAX expression itself. */
export function normalizeGeneratedDaxQueries(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    const query = value.trim();
    if (!query) return [];
    const statements = splitDaxStatements(query);
    return statements.every((statement) => statement.length <= MAX_DAX_QUERY_LENGTH)
      ? statements.slice(0, MAX_DAX_QUERIES)
      : undefined;
  }

  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return [];

  // Some MCP responses serialize a single string as one character per array item.
  if (value.length > 1 && value.every((entry) => typeof entry === "string" && entry.length <= 1)) {
    if (value.length > MAX_DAX_QUERY_LENGTH) return undefined;
    const query = (value as string[]).join("").trim();
    return query ? splitDaxStatements(query).slice(0, MAX_DAX_QUERIES) : [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .flatMap((entry) => splitDaxStatements(entry.trim()))
    .filter((entry) => entry.length > 0 && entry.length <= MAX_DAX_QUERY_LENGTH)
    .slice(0, MAX_DAX_QUERIES);
}

/** Split concatenated top-level DAX statements without touching strings or comments. */
export function splitDaxStatements(source: string): string[] {
  const query = source.trim();
  if (!query) return [];

  const boundaries = [0];
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let bracketed = false;
  let lineComment = false;
  let blockComment = false;
  let sawEvaluate = false;
  let inOrderBy = false;
  let pendingDefine: number | undefined;

  const isKeyword = (index: number, keyword: string) =>
    query.slice(index, index + keyword.length).toUpperCase() === keyword &&
    !/[A-Za-z0-9_]/.test(query[index - 1] ?? "") &&
    !/[A-Za-z0-9_]/.test(query[index + keyword.length] ?? "");

  // A transport may concatenate the final ASC/DESC token with the next EVALUATE.
  const isJoinedEvaluate = (index: number) =>
    inOrderBy &&
    query.slice(index, index + 8).toUpperCase() === "EVALUATE" &&
    !/[A-Za-z0-9_]/.test(query[index + 8] ?? "") &&
    ["ASC", "DESC"].some(
      (direction) =>
        query.slice(index - direction.length, index).toUpperCase() === direction &&
        !/[A-Za-z0-9_]/.test(query[index - direction.length - 1] ?? ""),
    );

  for (let index = 0; index < query.length; index += 1) {
    const character = query[index];
    const next = query[index + 1];

    if (lineComment) {
      if (character === "\n" || character === "\r") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === quote) {
        if (next === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (bracketed) {
      if (character === "]") {
        if (next === "]") index += 1;
        else bracketed = false;
      }
      continue;
    }
    if ((character === "-" && next === "-") || (character === "/" && next === "/")) {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") {
      bracketed = true;
      continue;
    }
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;

    if (sawEvaluate && isKeyword(index, "ORDER") && /^ORDER\s+BY\b/i.test(query.slice(index))) {
      inOrderBy = true;
    } else if (isKeyword(index, "DEFINE")) {
      if (sawEvaluate) pendingDefine = index;
      inOrderBy = false;
      index += "DEFINE".length - 1;
    } else if (isKeyword(index, "EVALUATE") || isJoinedEvaluate(index)) {
      if (sawEvaluate) boundaries.push(pendingDefine ?? index);
      sawEvaluate = true;
      inOrderBy = false;
      pendingDefine = undefined;
      index += "EVALUATE".length - 1;
    }
  }

  return boundaries
    .map((start, index) => query.slice(start, boundaries[index + 1] ?? query.length).trim())
    .filter(Boolean);
}

export function normalizeGeneratedDaxField(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;

  const record = input as Record<string, unknown>;
  if (!("generated_dax_query" in record)) return input;

  const queries = normalizeGeneratedDaxQueries(record.generated_dax_query);
  return queries === undefined ? input : { ...record, generated_dax_query: queries };
}
