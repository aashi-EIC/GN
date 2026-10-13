function plain(value: string) {
  return value.replace(/\*\*|__|`/g, "").trim();
}

function parseDataItem(line: string) {
  const bullet = line.match(/^\s*(?:[-*\u2022]|\d+[.)])\s+(.+)$/);
  if (!bullet) return undefined;
  const content = plain(bullet[1]);
  const match = content.match(
    /^(.+?)\s+\(([A-Za-z][\w -]*):\s*([^()]+)\)\s*(?:[\u2014\u2013-]|:)\s*([+-]?\d[\d,]*(?:\.\d+)?\s*%)\s*(decline|decrease|drop|increase|growth|improvement|completeness)?\.?$/i,
  );
  if (!match || match.slice(1).some((part) => part?.includes("|"))) return undefined;
  return {
    name: match[1],
    idLabel: match[2].trim(),
    id: match[3].trim(),
    value: match[4].replace(/\s+/g, ""),
    metric: match[5]?.toLowerCase() ?? "value",
  };
}

export function normalizeDataLists(text: string): string {
  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let fenced = false;
  for (let index = 0; index < lines.length; index++) {
    if (/^\s*```/.test(lines[index])) fenced = !fenced;
    const first = fenced ? undefined : parseDataItem(lines[index]);
    if (!first) {
      result.push(lines[index]);
      continue;
    }
    const items = [first];
    let end = index + 1;
    while (end < lines.length) {
      if (!lines[end].trim()) {
        end++;
        continue;
      }
      const item = parseDataItem(lines[end]);
      if (
        !item ||
        item.idLabel.toLowerCase() !== first.idLabel.toLowerCase() ||
        item.metric !== first.metric
      )
        break;
      items.push(item);
      end++;
    }
    // Only convert a complete, uniform list; prose and mixed lists stay untouched.
    const before = [...result].reverse().find((line) => line.trim());
    const after = lines[end];
    const isList = (line?: string) => Boolean(line && /^\s*(?:[-*\u2022]|\d+[.)])\s+/.test(line));
    if (items.length < 3 || isList(before) || isList(after)) {
      result.push(lines[index]);
      continue;
    }
    const metric =
      first.metric === "value" ? "Value" : first.metric[0].toUpperCase() + first.metric.slice(1);
    const entity = /^PrgSvcID$/i.test(first.idLabel) ? "Channel" : "Name";
    result.push(
      `| ${entity} | ${first.idLabel} | ${metric} (%) |`,
      "| --- | --- | --- |",
      ...items.map((item) => `| ${item.name} | ${item.id} | ${item.value} |`),
      "",
    );
    index = end - 1;
  }
  return result.join("\n");
}
