import type { ChartDatum, PlotSpec } from "../types/app";
import type { ModelId } from "../types/semantic";
import { getModel } from "./semantic";

export function buildPlotSpec(modelId: ModelId, title: string, data: ChartDatum[]): PlotSpec {
  const model = getModel(modelId);
  const html = buildPlotHtml(title, model.name, model.color, data);
  return {
    title,
    description: `${model.name} plotted from ${data.length} two-dimensional data points.`,
    html,
  };
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "gracenote-chart"
  );
}

function shortLabel(value: string) {
  return value.length > 10 ? `${value.slice(0, 9)}.` : value;
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPlotHtml(
  title: string,
  modelName: string,
  modelColor: string,
  data: ChartDatum[],
) {
  const width = 760;
  const height = 280;
  const padding = 42;
  const max = Math.max(...data.map((datum) => datum.value));
  const min = Math.min(...data.map((datum) => datum.value));
  const range = Math.max(1, max - min);
  const points = data.map((datum, index) => {
    const x =
      data.length === 1
        ? width / 2
        : padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((datum.value - min) / range) * (height - padding * 2);
    return { ...datum, x, y };
  });
  const polyline = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const bars = points
    .map((point, index) => {
      const barWidth = Math.max(22, (width - padding * 2) / Math.max(1, points.length) - 14);
      const barHeight = height - padding - point.y;
      const x = point.x - barWidth / 2;
      return `<rect x="${x.toFixed(1)}" y="${point.y.toFixed(1)}" width="${barWidth.toFixed(
        1,
      )}" height="${barHeight.toFixed(1)}" rx="4" class="bar" data-label="${htmlEscape(
        point.label,
      )}" data-value="${point.value.toFixed(1)}"></rect><text x="${point.x.toFixed(
        1,
      )}" y="${height - 12}" text-anchor="middle">${htmlEscape(shortLabel(point.label))}</text>${
        index === 0
          ? `<text x="${point.x.toFixed(1)}" y="${point.y - 10}" text-anchor="middle">${point.value.toFixed(
              1,
            )}</text>`
          : ""
      }`;
    })
    .join("");
  const circles = points
    .map(
      (point) =>
        `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(
          1,
        )}" r="5" class="point" data-label="${htmlEscape(point.label)}" data-value="${point.value.toFixed(
          1,
        )}"></circle>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { font-family: Inter, Arial, sans-serif; color: #002041; background: #ffffff; }
  body { margin: 0; padding: 18px; background: #ffffff; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; background: #fff; }
  h1 { margin: 0; font-size: 20px; line-height: 1.2; color: #002041; }
  p { margin: 5px 0 14px; color: #495b6c; font-size: 13px; }
  svg { width: 100%; height: auto; display: block; }
  .axis { stroke: #d8dee7; stroke-width: 1; }
  .grid { stroke: #eef1f5; stroke-width: 1; }
  .line { fill: none; stroke: ${modelColor}; stroke-width: 3; }
  .bar { fill: ${modelColor}; opacity: .18; transition: opacity .15s ease; }
  .point { fill: #fff; stroke: ${modelColor}; stroke-width: 3; cursor: pointer; }
  .bar:hover, .point:hover { opacity: .72; }
  text { fill: #495b6c; font-size: 11px; font-weight: 700; }
  .caption { display: flex; justify-content: space-between; gap: 16px; margin-top: 10px; color: #495b6c; font-size: 12px; }
  .caption strong { color: #f40953; }
</style>
</head>
<body>
  <section class="card">
    <h1>${htmlEscape(title)}</h1>
    <p>${htmlEscape(modelName)}</p>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${htmlEscape(title)}">
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="axis"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis"></line>
      <line x1="${padding}" y1="${padding + 52}" x2="${width - padding}" y2="${padding + 52}" class="grid"></line>
      <line x1="${padding}" y1="${padding + 104}" x2="${width - padding}" y2="${padding + 104}" class="grid"></line>
      ${bars}
      <polyline points="${polyline}" class="line"></polyline>
      ${circles}
    </svg>
    <div class="caption">
      <span id="point-label">Hover points to inspect values</span>
      <strong>Powered by gracenote</strong>
    </div>
  </section>
  <script>
    const label = document.getElementById("point-label");
    document.querySelectorAll("[data-label]").forEach((node) => {
      node.addEventListener("pointerenter", () => {
        label.textContent = node.dataset.label + ": " + node.dataset.value;
      });
    });
  </script>
</body>
</html>`;
}
