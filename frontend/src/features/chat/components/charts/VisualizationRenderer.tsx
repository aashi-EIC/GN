import type { VisualizationBlock } from "../../../../shared/types/app";
import { UniversalChart } from "./UniversalChart";

export function VisualizationRenderer({ blocks }: { blocks: VisualizationBlock[] }) {
  return (
    <div className="visualization-stack">
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
