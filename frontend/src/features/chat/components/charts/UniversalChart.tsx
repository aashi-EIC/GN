import * as echarts from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  BarChart3,
  LineChart,
  Table as TableIcon,
} from "lucide-react";
import type { EChartsOption } from "echarts";
import type { ChartBlock, VisualizationBlock } from "../../../../shared/types/app";
import { StructuredTable } from "./VisualizationRenderer";

const palette = ["#005D8F", "#f40953", "#00a878", "#f6a800", "#7f1534", "#5b7cfa", "#7c3aed"];

export function UniversalChart({ block }: { block: ChartBlock }) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [activeChartType, setActiveChartType] = useState<string>(block.chart_type || "bar");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // Sync active chart type if prop block changes
  useEffect(() => {
    setActiveChartType(block.chart_type || "bar");
  }, [block.chart_type]);

  const isRadial = ["pie", "donut", "gauge", "funnel"].includes(activeChartType);

  const option = useMemo(
    () => buildChartOption(block, activeChartType),
    [block, activeChartType],
  );

  useEffect(() => {
    if (viewMode !== "chart") return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    let chart = echarts.getInstanceByDom(container);
    if (!chart) {
      chart = echarts.init(container, undefined, { renderer: "svg" });
    }
    chartInstanceRef.current = chart;

    // Apply updated chart option with smooth transition
    chart.setOption(option, true);

    const resize = () => chart?.resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener("resize", resize);
    const initialResize = window.requestAnimationFrame(resize);

    return () => {
      window.cancelAnimationFrame(initialResize);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      if (chart) {
        chart.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [option, viewMode]);

  // Convert chart data to table block for Table View
  const tableEquivalentBlock = useMemo<Extract<VisualizationBlock, { type: "table" }> | null>(() => {
    if (!block.data?.length) return null;
    const sample = block.data[0];
    const columns = Object.keys(sample).map((key) => ({ key, label: formatHeaderLabel(key) }));
    return {
      type: "table",
      title: block.title,
      columns,
      rows: block.data,
    };
  }, [block]);

  return (
    <section className="chart-panel universal-chart-panel">
      <div className="chart-header-toolbar">
        <div className="chart-title-wrap">
          <div className="chart-title-main">
            <b>{block.title ?? "Analytics Chart"}</b>
            <span className="chart-type-badge">{formatChartTypeBadge(activeChartType)}</span>
          </div>
          {block.description && <span className="chart-subtitle">{block.description}</span>}
        </div>

        <div className="chart-toolbar-actions">
          {/* Chart Type Switcher Buttons */}
          {viewMode === "chart" && !isRadial && (
            <div className="chart-type-selector">
              <button
                type="button"
                className={`btn-chart-type ${activeChartType === "bar" ? "active" : ""}`}
                onClick={() => setActiveChartType("bar")}
                title="Vertical Bar Chart"
              >
                <BarChart3 size={14} />
                <span>Bar</span>
              </button>
              <button
                type="button"
                className={`btn-chart-type ${activeChartType === "line" ? "active" : ""}`}
                onClick={() => setActiveChartType("line")}
                title="Line Trend Chart"
              >
                <LineChart size={14} />
                <span>Line</span>
              </button>
              <button
                type="button"
                className={`btn-chart-type ${activeChartType === "horizontal-bar" ? "active" : ""}`}
                onClick={() => setActiveChartType("horizontal-bar")}
                title="Horizontal Bar Chart"
              >
                <AlignLeft size={14} />
                <span>Horizontal</span>
              </button>
            </div>
          )}

          {/* View Mode Toggle (Chart vs Data Table) */}
          {tableEquivalentBlock && (
            <div className="chart-view-toggle">
              <button
                type="button"
                className={`btn-view-toggle ${viewMode === "chart" ? "active" : ""}`}
                onClick={() => setViewMode("chart")}
                title="View as Chart"
              >
                <BarChart3 size={14} />
                <span>Chart</span>
              </button>
              <button
                type="button"
                className={`btn-view-toggle ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="View underlying Data Table"
              >
                <TableIcon size={14} />
                <span>Data</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === "chart" ? (
        <div
          className="universal-chart"
          ref={containerRef}
          style={chartHeight(block, activeChartType)}
        />
      ) : (
        tableEquivalentBlock && <StructuredTable block={tableEquivalentBlock} />
      )}
    </section>
  );
}

function formatHeaderLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatChartTypeBadge(type: string) {
  switch (type) {
    case "horizontal-bar":
      return "Horizontal Bar";
    case "stacked-bar":
      return "Stacked Bar";
    case "donut":
      return "Donut";
    case "pie":
      return "Pie";
    case "line":
      return "Trend Line";
    case "area":
      return "Area Trend";
    case "scatter":
      return "Scatter";
    case "bubble":
      return "Bubble";
    case "funnel":
      return "Funnel";
    case "gauge":
      return "Gauge";
    default:
      return "Bar Chart";
  }
}

function chartHeight(block: ChartBlock, activeType: string) {
  if (activeType !== "horizontal-bar") return { minHeight: "330px", height: "360px" };
  const categoryField = block.encoding?.x;
  const categoryCount = categoryField
    ? new Set(block.data?.map((row) => formatCell(row[categoryField]))).size
    : block.data?.length ?? 0;
  const height = Math.max(340, Math.min(680, categoryCount * 28 + 100));
  return { height: `${height}px` };
}

function buildChartOption(block: ChartBlock, activeType: string): EChartsOption {
  if (block.option && activeType === block.chart_type) return sanitizeOption(block.option);

  const data = block.data ?? [];
  const fields = inferFields(block);
  const categories = Array.from(new Set(data.map((row) => formatCell(row[fields.x]))));
  const isRadial = ["pie", "donut", "gauge", "funnel"].includes(activeType);
  const hasDenseData = categories.length > 8 && !isRadial;

  const base: EChartsOption = {
    color: palette,
    tooltip: {
      trigger: isRadial ? "item" : "axis",
      axisPointer: {
        type: activeType.includes("bar") ? "shadow" : "cross",
      },
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      borderColor: "rgba(0, 93, 143, 0.2)",
      textStyle: { color: "#002041", fontSize: 12 },
    },
    legend: {
      type: "scroll",
      bottom: hasDenseData ? 32 : 4,
      textStyle: { fontSize: 12 },
    },
    grid: {
      left: 42,
      right: 26,
      top: 42,
      bottom: hasDenseData ? 66 : 50,
      containLabel: true,
    },
    toolbox: {
      show: true,
      right: 12,
      top: 0,
      itemSize: 13,
      itemGap: 8,
      feature: {
        dataZoom: {
          show: hasDenseData,
          yAxisIndex: "none",
          title: { zoom: "Zoom Area", back: "Restore" },
        },
        restore: { title: "Reset" },
        saveAsImage: {
          title: "Save Image",
          pixelRatio: 2,
          name: (block.title || "chart").toLowerCase().replace(/\s+/g, "_"),
        },
      },
    },
    ...(hasDenseData
      ? {
          dataZoom: [
            { type: "inside", start: 0, end: 100 },
            {
              type: "slider",
              start: 0,
              end: Math.min(100, (10 / categories.length) * 100),
              bottom: 4,
              height: 18,
              borderColor: "transparent",
              backgroundColor: "rgba(0, 93, 143, 0.05)",
              fillerColor: "rgba(0, 93, 143, 0.15)",
              handleStyle: { color: "#005D8F" },
            },
          ],
        }
      : {}),
  };

  if (activeType === "pie" || activeType === "donut") {
    return {
      ...base,
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: activeType === "donut" ? ["45%", "70%"] : "70%",
          data: data.map((row) => ({
            name: formatCell(row[fields.name]),
            value: Number(row[fields.value] ?? 0),
          })),
        },
      ],
    };
  }

  if (activeType === "scatter" || activeType === "bubble") {
    return {
      ...base,
      xAxis: { type: "value", name: fields.x },
      yAxis: { type: "value", name: fields.y },
      series: [
        {
          type: "scatter",
          symbolSize: (value: unknown) => {
            if (activeType !== "bubble" || !Array.isArray(value)) return 12;
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

  if (activeType === "gauge") {
    const first = data[0] ?? {};
    return {
      ...base,
      series: [
        {
          type: "gauge",
          progress: { show: true },
          data: [{ value: Number(first[fields.value] ?? 0) }],
        },
      ],
    };
  }

  if (activeType === "funnel") {
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

  const colorField = fields.color;
  const seriesNames = colorField
    ? Array.from(new Set(data.map((row) => formatCell(row[colorField]))))
    : [fields.y];

  const isHorizontal = activeType === "horizontal-bar";
  const isLine = activeType === "line" || activeType === "area";
  const isStacked = activeType === "stacked-bar";

  return {
    ...base,
    xAxis: isHorizontal
      ? { type: "value" }
      : { type: "category", data: categories },
    yAxis: isHorizontal
      ? { type: "category", data: categories }
      : { type: "value" },
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
        type: isLine ? "line" : "bar",
        smooth: isLine,
        stack: isStacked ? "total" : undefined,
        areaStyle: activeType === "area" ? {} : undefined,
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
