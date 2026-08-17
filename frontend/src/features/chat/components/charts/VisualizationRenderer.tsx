import type { VisualizationBlock } from "../../../../shared/types/app";
import { UniversalChart } from "./UniversalChart";

export function VisualizationRenderer({ blocks }: { blocks: VisualizationBlock[] }) {
  const inferredChart = blocks.some((block) => block.type === "chart")
    ? undefined
    : blocks
        .filter((block): block is Extract<VisualizationBlock, { type: "table" }> => block.type === "table")
        .map(inferChartFromTable)
        .find((block) => block !== undefined);

  return (
    <div className="visualization-stack">
      {inferredChart && <UniversalChart block={inferredChart} />}
      {blocks.map((block, index) => {
        if (block.type === "text") {
          return <p key={`${block.type}-${index}`}>{block.content}</p>;
        }

        if (block.type === "table") {
          return <StructuredTable key={`${block.type}-${index}`} block={block} />;
        }

        return <UniversalChart key={`${block.type}-${index}`} block={block} />;
      })}
    </div>
  );
}

function inferChartFromTable(
  block: Extract<VisualizationBlock, { type: "table" }>,
): Extract<VisualizationBlock, { type: "chart" }> | undefined {
  const rows = block.rows.filter(
    (row): row is Record<string, string | number | boolean | null> => !Array.isArray(row),
  );
  if (rows.length < 2) return undefined;

  const keys = block.columns.map((column) => typeof column === "string" ? column : column.key);
  const numericKeys = keys.filter((key) => isMostlyNumeric(rows.map((row) => row[key])));
  const categoryKey = keys.find((key) => !numericKeys.includes(key));
  if (!categoryKey || numericKeys.length === 0) return undefined;

  const measureKeys = numericKeys
    .sort((left, right) => measurePriority(right) - measurePriority(left))
    .slice(0, 3);
  const orderedRows = rows.length > 15
    ? [...rows]
        .sort((left, right) => toNumber(right[measureKeys[0]]) - toNumber(left[measureKeys[0]]))
        .slice(0, 15)
    : rows;
  const temporal = isTemporalField(categoryKey, orderedRows.map((row) => row[categoryKey]));
  const chartData = orderedRows.flatMap((row) => measureKeys.map((measure) => ({
    category: String(row[categoryKey] ?? "Unknown"),
    measure,
    value: toNumber(row[measure]),
  })));

  return {
    type: "chart",
    chart_type: temporal ? "line" : "bar",
    title: block.title ? `${block.title} overview` : "Data overview",
    description: rows.length > 15
      ? `Demo visualization showing the top 15 of ${rows.length} rows. The full result remains available in the table.`
      : "Demo visualization inferred from the structured MCP result.",
    data: chartData,
    encoding: {
      x: "category",
      y: "value",
      ...(measureKeys.length > 1 ? { color: "measure" } : {}),
    },
  };
}

function isMostlyNumeric(values: Array<string | number | boolean | null | undefined>) {
  const populated = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!populated.length) return false;
  return populated.filter((value) => Number.isFinite(toNumber(value))).length / populated.length >= 0.8;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.trim().replace(/,/g, "").replace(/%$/, "");
  return normalized ? Number(normalized) : Number.NaN;
}

function measurePriority(key: string) {
  if (/completeness|percent|percentage|rate|score/i.test(key)) return 3;
  if (/total|count|amount|value|sales|revenue/i.test(key)) return 2;
  return 1;
}

function isTemporalField(key: string, values: Array<string | number | boolean | null>) {
  if (/date|time|day|week|month|quarter|year/i.test(key)) return true;
  return values.filter((value) => typeof value === "string")
    .some((value) => /^(?:\d{4}(?:-\d{1,2})?|w\d+|q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(value));
}

function StructuredTable({ block }: { block: Extract<VisualizationBlock, { type: "table" }> }) {
  const columns = block.columns.map((column) =>
    typeof column === "string" ? { key: column, label: column } : { key: column.key, label: column.label ?? column.key },
  );

  return (
    <section className="table-section">
      {block.title && <b className="table-title">{block.title}</b>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column, cellIndex) => (
                  <td key={`${column.key}-${cellIndex}`}>
                    {formatCell(Array.isArray(row) ? row[cellIndex] : row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
