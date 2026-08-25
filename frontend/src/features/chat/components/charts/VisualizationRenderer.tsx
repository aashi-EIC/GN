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
  X,
} from "lucide-react";
import type { VisualizationBlock } from "../../../../shared/types/app";

export function VisualizationRenderer({ blocks }: { blocks: VisualizationBlock[] }) {
  const tables = blocks.filter(
    (block): block is Extract<VisualizationBlock, { type: "table" }> => block.type === "table",
  );
  const textBlocks = blocks.filter(
    (block): block is Extract<VisualizationBlock, { type: "text" }> => block.type === "text",
  );

  return (
    <div className="visualization-stack">
      {tables.map((block, index) => (
        <StructuredTable key={`${block.type}-${index}`} block={block} />
      ))}
      {textBlocks.map((block, index) => (
        <p key={`${block.type}-${index}`}>{block.content}</p>
      ))}
    </div>
  );
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.trim().replace(/,/g, "").replace(/%$/, "");
  return normalized ? Number(normalized) : Number.NaN;
}

const NOISE_COLUMNS = new Set([
  "tenant_id",
  "id",
  "uuid",
  "_id",
  "created_at",
  "updated_at",
  "raw_payload",
  "__v",
  "sys_id",
]);

function humanizeColumnLabel(key: string): string {
  const customMap: Record<string, string> = {
    channel_name: "Channel",
    channel_id: "Channel ID",
    completeness_pct: "Completeness %",
    completeness_rate: "Completeness %",
    tba_hours: "TBA (hrs)",
    signoff_hours: "Sign-off (hrs)",
    sign_off_hours: "Sign-off (hrs)",
    generic_hours: "Generic (hrs)",
    horizon_days: "Horizon",
    total_assets: "Total Assets",
    mapped_assets: "Mapped",
    unmapped_assets: "To Be Mapped",
    unmappable_assets: "Unmappable",
    c2m_hours: "C2M (hrs)",
  };

  const lower = key.toLowerCase().trim();
  if (customMap[lower]) return customMap[lower];

  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StructuredTable({
  block,
  minimal = false,
}: {
  block: Extract<VisualizationBlock, { type: "table" }>;
  minimal?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);
  const [pageSize, setPageSize] = useState<number>(minimal ? -1 : 5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  const columns = useMemo(() => {
    const allCols = block.columns.map((column) =>
      typeof column === "string"
        ? { key: column, label: humanizeColumnLabel(column) }
        : { key: column.key, label: column.label ? column.label : humanizeColumnLabel(column.key) },
    );

    if (allCols.length > 3) {
      const essential = allCols.filter((col) => !NOISE_COLUMNS.has(col.key.toLowerCase()));
      return essential.length > 0 ? essential : allCols;
    }
    return allCols;
  }, [block.columns]);

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
    <section className={minimal ? "table-section minimal-table-container" : "table-section interactive-table-container"}>
      {/* Header Toolbar */}
      <div className={minimal ? "minimal-table-toolbar" : "table-header-toolbar"}>
        {!minimal && (
          <div className="table-header-left">
            <TableIcon size={16} className="table-icon-header" />
            <b className="table-title">{block.title || "Query Results"}</b>
            <span className="table-row-count-badge">
              {totalRows} {totalRows === 1 ? "row" : "rows"}
            </span>
          </div>
        )}
        {minimal && <div className="table-header-left" />}

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
      <div className={minimal ? "minimal-table-scroll-area" : "table-wrap"}>
        <table className={minimal ? "markdown-table" : "interactive-data-table"}>
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
                    aria-sort={
                      isSorted
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
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
                        {formatCell(rawVal, column.key)}
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
      {!minimal && totalRows > 5 && (
        <div className="table-footer-pagination">
          <div className="pagination-info">
            Showing {(safePage - 1) * pageSize + 1}–
            {isAll ? totalRows : Math.min(safePage * pageSize, totalRows)} of {totalRows}
            {searchQuery && ` (filtered from ${rawRows.length})`}
          </div>

          <div className="pagination-controls">
            <label className="page-size-label">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="page-size-select"
              >
                <option value={5}>5</option>
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

function formatCell(value: unknown, columnKey: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  const str = String(value).trim();
  const lower = str.toLowerCase();

  if (lower === "complete" || lower === "100%" || lower === "mapped" || lower === "success") {
    return <span className="table-badge badge-success">{str}</span>;
  }
  if (lower === "tba" || lower === "to be mapped" || lower === "in progress" || lower === "partial") {
    return <span className="table-badge badge-warning">{str}</span>;
  }
  if (lower === "sign-off" || lower === "signoff" || lower === "generic" || lower === "unmappable" || lower === "failed") {
    return <span className="table-badge badge-danger">{str}</span>;
  }

  if (typeof value === "number") {
    const keyLower = columnKey.toLowerCase();
    if (
      keyLower.includes("pct") ||
      keyLower.includes("rate") ||
      keyLower.includes("percent") ||
      keyLower.includes("completeness")
    ) {
      const formatted = value <= 1 && value > 0 ? (value * 100).toFixed(1) : value.toFixed(1);
      const numFormatted = Number(formatted);
      const isHigh = numFormatted >= 95;
      const isLow = numFormatted < 80;
      return (
        <span className={`table-pct-val ${isHigh ? "high-pct" : isLow ? "low-pct" : ""}`}>
          {formatted}%
        </span>
      );
    }
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return str;
}

