import type { ChartDatum } from "../../../../shared/types/app";
import { formatClock } from "../../../../shared/utils/formatDate";

export function BarChart({ title, data }: { title: string; data: ChartDatum[] }) {
  const max = Math.max(...data.map((datum) => datum.value));

  return (
    <div className="chart-panel">
      <div className="chart-title">
        <b>{title}</b>
        <span>Updated {formatClock(new Date())}</span>
      </div>
      <div className="bar-chart">
        {data.map((datum) => (
          <div className="bar-col" key={datum.label}>
            <i style={{ height: `${Math.max(8, (datum.value / max) * 100)}%` }} />
            <span>{datum.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
