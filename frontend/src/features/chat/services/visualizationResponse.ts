import type {
  ChartBlock,
  ChartType,
  TableBlock,
  VisualizationBlock,
} from "../../../shared/types/app";

type Scalar = string | number | boolean | null;
type RecordRow = Record<string, Scalar>;

const chartTypes = new Set<ChartType>([
  "line",
  "area",
  "bar",
  "stacked-bar",
  "horizontal-bar",
  "pie",
  "donut",
  "scatter",
  "bubble",
  "heatmap",
  "radar",
  "funnel",
  "gauge",
]);

export function normalizeVisualizationBlocks(value: unknown): VisualizationBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const blocks = value.flatMap((candidate) => {
    if (isRecord(candidate) && candidate.type === "text" && typeof candidate.content === "string") {
      const extracted = extractVisualizationBlocks(candidate.content);
      return [
        ...(extracted.text ? [{ type: "text" as const, content: extracted.text }] : []),
        ...extracted.blocks,
      ];
    }
    const block = normalizeBlock(candidate);
    return block ? [block] : [];
  });

  return blocks.length ? blocks : undefined;
}

export function extractVisualizationBlocks(text: string) {
  const blocks: VisualizationBlock[] = [];
  const cleanedText = text.replace(
    /```(?:[a-z][\w-]*)?\s*([\s\S]*?)```/gi,
    (fullMatch, source: string, offset: number) => {
      const title = precedingTitle(text, offset);
      const parsed = parseJson(source);
      const extracted =
        parsed === undefined ? chartFromLabelledText(source, title) : blocksFromJson(parsed, title);
      if (!extracted.length) return fullMatch;

      blocks.push(...extracted);
      return "";
    },
  );

  return {
    text: cleanedText.replace(/\n{3,}/g, "\n\n").trim(),
    blocks,
  };
}

function chartFromLabelledText(source: string, title: string): VisualizationBlock[] {
  const chartType = chartTypeFromText(title);
  if (!chartType) return [];

  const data = Array.from(
    source.matchAll(/^\s*([^\n|:[\]{}]{1,120}?)\s*\(\s*([-+]?\d[\d,]*(?:\.\d+)?)\s*%?\s*\)\s*$/gm),
    (match) => ({
      label: match[1].trim(),
      value: Number(match[2].replace(/,/g, "")),
    }),
  ).filter((point) => point.label && Number.isFinite(point.value));

  if (data.length < 2) return [];
  return [
    {
      type: "chart",
      chart_type: chartType,
      title,
      data: data.slice(0, 10_000),
      encoding: { name: "label", value: "value", x: "label", y: "value" },
    },
  ];
}

function normalizeBlock(value: unknown): VisualizationBlock | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;

  if (value.type === "text" && typeof value.content === "string") {
    return { type: "text", content: value.content };
  }

  if (value.type === "chart" && isChartType(value.chart_type)) {
    const data = normalizeChartData(value.data);
    const block: ChartBlock = {
      type: "chart",
      chart_type: value.chart_type,
      ...(typeof value.title === "string" ? { title: value.title } : {}),
      ...(typeof value.description === "string" ? { description: value.description } : {}),
      ...(data ? { data } : {}),
      ...(isEncoding(value.encoding) ? { encoding: value.encoding } : {}),
      ...(isRecord(value.option) ? { option: value.option } : {}),
    };
    return block;
  }

  if (value.type === "table") return normalizeTable(value);
  return undefined;
}

function normalizeChartData(value: unknown): RecordRow[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const records = value.filter(isScalarRecord);
  if (records.length === value.length) return records.slice(0, 100_000);

  if (value.every(Array.isArray)) return matrixToRecords(value).slice(0, 100_000);
  return undefined;
}

function normalizeTable(value: Record<string, unknown>): TableBlock | undefined {
  if (!Array.isArray(value.rows)) return undefined;

  const suppliedColumns = readColumns(value.columns);
  const matrix = value.rows.every(Array.isArray) ? value.rows : undefined;
  const inferredColumns = matrix ? matrixHeaders(matrix) : undefined;
  const recordRows = matrix
    ? undefined
    : value.rows.filter((row): row is RecordRow => isScalarRecord(row));
  const recordColumns = recordRows?.length
    ? Array.from(new Set(recordRows.flatMap((row) => Object.keys(row)))).slice(0, 100)
    : undefined;
  const columns = suppliedColumns ?? inferredColumns?.headers ?? recordColumns;
  if (!columns?.length) return undefined;

  const rows = matrix
    ? matrix.slice(inferredColumns?.consumedHeader ? 1 : 0).filter(isScalarArray)
    : recordRows ?? [];

  return {
    type: "table",
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    columns,
    rows: rows.slice(0, 10_000),
  };
}

function matrixToRecords(matrix: unknown[][]): RecordRow[] {
  const headerInfo = matrixHeaders(matrix);
  if (!headerInfo) return [];

  return matrix
    .slice(headerInfo.consumedHeader ? 1 : 0)
    .filter(isScalarArray)
    .map((row) =>
      Object.fromEntries(
        headerInfo.headers.map((header, index) => [header, row[index] ?? null]),
      ),
    );
}

function parseJson(source: string): unknown {
  try {
    return JSON.parse(source.trim()) as unknown;
  } catch {
    return undefined;
  }
}

function blocksFromJson(value: unknown, title: string): VisualizationBlock[] {
  if (isRecord(value)) {
    const typedBlock = normalizeBlock(value);
    if (typedBlock) return [typedBlock];

    const chartType = value.chart_type ?? value.chartType ?? value.chart;
    if (isChartType(chartType)) {
      const chart = normalizeBlock({ ...value, type: "chart", chart_type: chartType, title });
      return chart ? [chart] : [];
    }

    const pairedData = recordsFromLabelsAndValues(value.labels, value.values);
    if (pairedData) {
      return [
        {
          type: "chart",
          chart_type: chartTypeFromText(title) ?? "bar",
          title,
          data: pairedData,
          encoding: { name: "label", value: "value", x: "label", y: "value" },
        },
      ];
    }
    return [];
  }

  if (!Array.isArray(value) || value.length < 2) return [];

  const table = normalizeTable({ type: "table", title, rows: value });
  return table ? [table] : [];
}

function recordsFromLabelsAndValues(labels: unknown, values: unknown): RecordRow[] | undefined {
  if (!Array.isArray(labels) || !Array.isArray(values) || labels.length !== values.length) {
    return undefined;
  }
  if (!labels.every(isScalar) || !values.every(isScalar)) return undefined;
  return labels.slice(0, 10_000).map((label, index) => ({ label, value: values[index] ?? null }));
}

function chartTypeFromText(value: string): ChartType | undefined {
  if (/\bdonut\b/i.test(value)) return "donut";
  if (/\bpie\b/i.test(value)) return "pie";
  if (/\bline\b|\btrend\b/i.test(value)) return "line";
  if (/\barea\b/i.test(value)) return "area";
  if (/\bscatter\b/i.test(value)) return "scatter";
  if (/\bbar\b/i.test(value)) return "bar";
  return undefined;
}

function precedingTitle(text: string, offset: number) {
  const lines = text.slice(0, offset).trimEnd().split(/\r?\n/);
  const candidate = lines.at(-1)?.replace(/^#{1,6}\s*/, "").trim();
  return candidate && candidate.length <= 200 ? candidate : "Query result";
}

function matrixHeaders(matrix: unknown[][]) {
  const width = Math.min(100, Math.max(0, ...matrix.map((row) => row.length)));
  if (!width) return undefined;

  const firstRow = matrix[0] ?? [];
  const hasHeader =
    firstRow.length > 0 &&
    firstRow.every((cell) => typeof cell === "string" && cell.trim().length > 0);
  const rawHeaders = hasHeader
    ? firstRow.slice(0, width).map(String)
    : Array.from({ length: width }, (_, index) => `column_${index + 1}`);

  return {
    headers: uniqueHeaders(rawHeaders),
    consumedHeader: hasHeader,
  };
}

function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function readColumns(value: unknown): TableBlock["columns"] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const columns = value.filter(
    (column): column is string | { key: string; label?: string } =>
      typeof column === "string" ||
      (isRecord(column) &&
        typeof column.key === "string" &&
        (column.label === undefined || typeof column.label === "string")),
  );
  return columns.length === value.length ? columns.slice(0, 100) : undefined;
}

function isEncoding(value: unknown): value is NonNullable<ChartBlock["encoding"]> {
  if (!isRecord(value)) return false;
  return ["x", "y", "name", "value", "color", "size"].every(
    (key) => value[key] === undefined || typeof value[key] === "string",
  );
}

function isChartType(value: unknown): value is ChartType {
  return typeof value === "string" && chartTypes.has(value as ChartType);
}

function isScalarArray(value: unknown): value is Scalar[] {
  return Array.isArray(value) && value.slice(0, 100).every(isScalar);
}

function isScalarRecord(value: unknown): value is RecordRow {
  return isRecord(value) && Object.values(value).every(isScalar);
}

function isScalar(value: unknown): value is Scalar {
  return (
    value === null ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
