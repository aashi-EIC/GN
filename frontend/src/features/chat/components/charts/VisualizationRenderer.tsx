import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Search,
  Table as TableIcon,
  X,
} from "lucide-react";
import type { VisualizationBlock } from "../../../../shared/types/app";
import { UniversalChart } from "./UniversalChart";

export function VisualizationRenderer({ blocks }: { blocks: VisualizationBlock[] }) {
  const inferredChart = blocks.some((block) => block.type === "chart")
    ? undefined
    : blocks
        .filter(
          (block): block is Extract<VisualizationBlock, { type: "table" }> =>
            block.type === "table",
        )
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

  const keys = block.columns.map((column) => (typeof column === "string" ? column : column.key));
  const numericKeys = keys.filter((key) => isMostlyNumeric(rows.map((row) => row[key])));
  const categoryKey = keys.find((key) => !numericKeys.includes(key));
  if (!categoryKey || numericKeys.length === 0) return undefined;

  const measureKeys = numericKeys
    .sort((left, right) => measurePriority(right) - measurePriority(left))
    .slice(0, 3);
  const orderedRows =
    rows.length > 15
      ? [...rows]
          .sort((left, right) => toNumber(right[measureKeys[0]]) - toNumber(left[measureKeys[0]]))
          .slice(0, 15)
      : rows;
  const temporal = isTemporalField(
    categoryKey,
    orderedRows.map((row) => row[categoryKey]),
  );
  const requestedChartType = chartTypeFromTitle(block.title);
  const chartData = orderedRows.flatMap((row) =>
    measureKeys.map((measure) => ({
      category: String(row[categoryKey] ?? "Unknown"),
      measure,
      value: toNumber(row[measure]),
    })),
  );

  const titleText = (block.title ?? "").toLowerCase();
  let inferredType: "line" | "area" | "horizontal-bar" | "bar" | "pie" | "donut" = "bar";

  if (titleText.includes("pie")) {
    inferredType = "pie";
  } else if (titleText.includes("donut")) {
    inferredType = "donut";
  } else if (titleText.includes("area")) {
    inferredType = "area";
  } else if (temporal) {
    inferredType = "line";
  } else if (
    orderedRows.length >= 2 &&
    orderedRows.length <= 6 &&
    (titleText.includes("share") || titleText.includes("distribution") || titleText.includes("proportion") || titleText.includes("split"))
  ) {
    inferredType = "pie";
  } else if (measureKeys.length === 1 && orderedRows.length >= 5) {
    inferredType = "horizontal-bar";
  }

  return {
    type: "chart",
    chart_type: requestedChartType ?? inferredType,
    title: block.title ? `${block.title} overview` : "Data overview",
    description:
      rows.length > 15
        ? `Interactive visualization showing top 15 of ${rows.length} rows. Full result is available in the table below.`
        : "Interactive visualization generated from query results.",
    data: chartData,
    encoding: {
      x: "category",
      y: "value",
      ...(measureKeys.length > 1 ? { color: "measure" } : {}),
    },
  };
}

function chartTypeFromTitle(title?: string) {
  if (!title) return undefined;
  if (/\bdonut\b/i.test(title)) return "donut" as const;
  if (/\bpie(?:\s+chart)?\b/i.test(title)) return "pie" as const;
  if (/\bline(?:\s+chart)?\b|\btrend\b/i.test(title)) return "line" as const;
  if (/\barea(?:\s+chart)?\b/i.test(title)) return "area" as const;
  if (/\bhorizontal(?:\s+bar)?\b/i.test(title)) return "horizontal-bar" as const;
  if (/\bbar(?:\s+chart)?\b/i.test(title)) return "bar" as const;
  return undefined;
}

function isMostlyNumeric(values: Array<string | number | boolean | null | undefined>) {
  const populated = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (!populated.length) return false;
  return (
    populated.filter((value) => Number.isFinite(toNumber(value))).length / populated.length >= 0.8
  );
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
  return values
    .filter((value) => typeof value === "string")
    .some((value) =>
      /^(?:\d{4}(?:-\d{1,2})?|w\d+|q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(
        value,
      ),
    );
}

export function StructuredTable({
  block,
}: {
  block: Extract<VisualizationBlock, { type: "table" }>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const columns = useMemo(
    () =>
      block.columns.map((column) =>
        typeof column === "string"
          ? { key: column, label: column }
          : { key: column.key, label: column.label ?? column.key },
      ),
    [block.columns],
  );

  const rawRows = useMemo(
    () =>
      block.rows.map((row) => {
        if (Array.isArray(row)) {
          const record: Record<string, unknown> = {};
          columns.forEach((col, idx) => {
            record[col.key] = row[idx];
          });
          return record;
        }
        return row;
      }),
    [block.rows, columns],
  );

  // Search filtering
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rawRows;
    const q = searchQuery.toLowerCase().trim();
    return rawRows.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
      }),
    );
  }, [rawRows, columns, searchQuery]);

  // Column Sorting
  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const numA = toNumber(valA);
      const numB = toNumber(valB);

      let cmp = 0;
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        cmp = numA - numB;
      } else {
        cmp = String(valA ?? "").localeCompare(String(valB ?? ""), undefined, { numeric: true });
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortKey, sortDirection]);

  // Pagination
  const totalRows = sortedRows.length;
  const isAll = pageSize >= totalRows || pageSize <= 0;
  const totalPages = isAll ? 1 : Math.ceil(totalRows / pageSize);
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedRows = useMemo(() => {
    if (isAll) return sortedRows;
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize, isAll]);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortKey(null);
      setSortDirection(null);
    }
  };

  const exportCsv = () => {
    const headerRow = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const dataRows = sortedRows.map((row) =>
      columns
        .map((c) => {
          const val = row[c.key] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csvContent =
      "data:text/csv;charset=utf-8," + encodeURIComponent([headerRow, ...dataRows].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute(
      "download",
      `${(block.title || "query_results").toLowerCase().replace(/\s+/g, "_")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyTsv = async () => {
    const headerRow = columns.map((c) => c.label).join("\t");
    const dataRows = sortedRows.map((row) =>
      columns.map((c) => String(row[c.key] ?? "")).join("\t"),
    );
    const text = [headerRow, ...dataRows].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="table-section interactive-table-container">
      {/* Header Toolbar */}
      <div className="table-header-toolbar">
        <div className="table-header-left">
          <TableIcon size={16} className="table-icon-header" />
          <b className="table-title">{block.title || "Query Results"}</b>
          <span className="table-row-count-badge">
            {totalRows} {totalRows === 1 ? "row" : "rows"}
          </span>
        </div>

        <div className="table-actions-right">
          {/* Quick Search */}
          <div className="table-search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search table..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="table-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Copy TSV button */}
          <button
            type="button"
            className="btn-table-action"
            onClick={copyTsv}
            title="Copy to clipboard (ready for Excel/Sheets)"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Export CSV button */}
          <button
            type="button"
            className="btn-table-action"
            onClick={exportCsv}
            title="Export as CSV file"
          >
            <Download size={14} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-wrap">
        <table className="interactive-data-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column.key)}
                    className={`sortable-th ${isSorted ? "is-sorted" : ""}`}
                    title={`Sort by ${column.label}`}
                  >
                    <div className="th-content">
                      <span>{column.label}</span>
                      <span className="sort-icon-wrap">
                        {isSorted && sortDirection === "asc" ? (
                          <ArrowUp size={13} className="sort-icon active" />
                        ) : isSorted && sortDirection === "desc" ? (
                          <ArrowDown size={13} className="sort-icon active" />
                        ) : (
                          <ArrowUpDown size={12} className="sort-icon idle" />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length > 0 ? (
              paginatedRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => {
                    const rawVal = row[column.key];
                    const numVal = toNumber(rawVal);
                    const isNum = !Number.isNaN(numVal) && typeof rawVal !== "boolean";
                    return (
                      <td
                        key={column.key}
                        className={isNum ? "cell-number" : "cell-text"}
                      >
                        {formatCell(rawVal)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="empty-table-cell">
                  No matching records found for "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination Bar */}
      {totalRows > 10 && (
        <div className="table-footer-pagination">
          <div className="pagination-info">
            Showing {(safePage - 1) * pageSize + 1}–
            {isAll ? totalRows : Math.min(safePage * pageSize, totalRows)} of {totalRows}
            {searchQuery && ` (filtered from ${rawRows.length})`}
          </div>

          <div className="pagination-controls">
            <label className="page-size-label">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="page-size-select"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={totalRows}>All</option>
              </select>
            </label>

            {!isAll && totalPages > 1 && (
              <div className="page-nav-buttons">
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="page-indicator">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

