import * as echarts from "echarts";
import { useEffect, useMemo, useRef } from "react";
import type { EChartsOption } from "echarts";
import type { ChartBlock } from "../../../../shared/types/app";

const palette = ["#f40953", "#7f1534", "#002041", "#00a878", "#f6a800", "#5b7cfa"];

export function UniversalChart({ block }: { block: ChartBlock }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const option = useMemo(() => buildChartOption(block), [block]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = echarts.init(container, undefined, { renderer: "svg" });
    chart.setOption(option, true);

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);

  return (
    <section className="chart-panel universal-chart-panel">
      {(block.title || block.description) && (
        <div className="chart-title">
          <b>{block.title ?? "Chart"}</b>
          {block.description && <span>{block.description}</span>}
        </div>
      )}
      <div className="universal-chart" ref={containerRef} />
    </section>
  );
}

function buildChartOption(block: ChartBlock): EChartsCoreOption {
  if (block.option) return sanitizeOption(block.option);

  const data = block.data ?? [];
  const fields = inferFields(block);
  const base: EChartsCoreOption = {
    color: palette,
    tooltip: { trigger: "axis" },
    legend: { type: "scroll", bottom: 0 },
    grid: { left: 42, right: 22, top: 28, bottom: 58, containLabel: true },
  };

  if (block.chart_type === "pie" || block.chart_type === "donut") {
    return {
      ...base,
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: block.chart_type === "donut" ? ["45%", "70%"] : "70%",
          data: data.map((row) => ({
            name: formatCell(row[fields.name]),
            value: Number(row[fields.value] ?? 0),
          })),
        },
      ],
    };
  }

  if (block.chart_type === "scatter" || block.chart_type === "bubble") {
    return {
      ...base,
      xAxis: { type: "value", name: fields.x },
      yAxis: { type: "value", name: fields.y },
      series: [
        {
          type: "scatter",
          symbolSize: (value: unknown) => {
            if (block.chart_type !== "bubble" || !Array.isArray(value)) return 12;
            return Math.max(8, Math.min(44, Number(value[2] ?? 12)));
          },
          data: data.map((row) => [
            Number(row[fields.x] ?? 0),
            Number(row[fields.y] ?? 0),
            Number(row[fields.size] ?? 12),
          ]),
        },
      ],
    };
  }

  if (block.chart_type === "gauge") {
    const first = data[0] ?? {};
    return {
      ...base,
      series: [{ type: "gauge", progress: { show: true }, data: [{ value: Number(first[fields.value] ?? 0) }] }],
    };
  }

  if (block.chart_type === "funnel") {
    return {
      ...base,
      tooltip: { trigger: "item" },
      series: [
        {
          type: "funnel",
          data: data.map((row) => ({
            name: formatCell(row[fields.name]),
            value: Number(row[fields.value] ?? 0),
          })),
        },
      ],
    };
  }

  const categories = Array.from(new Set(data.map((row) => formatCell(row[fields.x]))));
  const colorField = fields.color;
  const seriesNames = colorField
    ? Array.from(new Set(data.map((row) => formatCell(row[colorField]))))
    : [fields.y];

  return {
    ...base,
    xAxis: block.chart_type === "horizontal-bar" ? { type: "value" } : { type: "category", data: categories },
    yAxis: block.chart_type === "horizontal-bar" ? { type: "category", data: categories } : { type: "value" },
    series: seriesNames.map((name) => {
      const values = categories.map((category) => {
        const row = data.find((item) => {
          const sameCategory = formatCell(item[fields.x]) === category;
          const sameSeries = colorField ? formatCell(item[colorField]) === name : true;
          return sameCategory && sameSeries;
        });
        return Number(row?.[fields.y] ?? 0);
      });

      return {
        name,
        type: block.chart_type.includes("bar") ? "bar" : "line",
        stack: block.chart_type === "stacked-bar" ? "total" : undefined,
        areaStyle: block.chart_type === "area" ? {} : undefined,
        data: values,
      };
    }),
  };
}

function inferFields(block: ChartBlock) {
  const sample = block.data?.[0] ?? {};
  const keys = Object.keys(sample);
  const first = keys[0] ?? "name";
  const second = keys[1] ?? "value";
  const third = keys[2] ?? second;

  return {
    x: block.encoding?.x ?? first,
    y: block.encoding?.y ?? block.encoding?.value ?? second,
    name: block.encoding?.name ?? block.encoding?.x ?? first,
    value: block.encoding?.value ?? block.encoding?.y ?? second,
    color: block.encoding?.color,
    size: block.encoding?.size ?? third ?? second,
  };
}

function sanitizeOption(option: Record<string, unknown>): EChartsOption {
  return JSON.parse(
    JSON.stringify(option, (key, value) => {
      if (typeof value === "function") return undefined;
      if (/^on/i.test(key)) return undefined;
      return value;
    }),
  ) as EChartsOption;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
