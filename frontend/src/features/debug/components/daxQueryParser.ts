/** Handle older debug payloads as well as the BFF's normalized DAX array. */
export function readDaxQueries(value: unknown): string[] {
  const entries =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
  const queries =
    entries.length > 1 && entries.every((entry) => entry.length <= 1)
      ? [entries.join("")]
      : entries;

  return queries.flatMap((query) => splitDaxStatements(stripDaxFence(query).trim())).slice(0, 100);
}

function stripDaxFence(query: string) {
  return query.replace(/^\s*```(?:dax)?\s*/i, "").replace(/\s*```\s*$/, "");
}

/** Find statement boundaries only outside DAX strings, identifiers, and comments. */
function splitDaxStatements(source: string): string[] {
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
