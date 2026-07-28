import { Download, Maximize2, Minimize2, Share2 } from "lucide-react";
import { useState } from "react";
import type { PlotSpec, ToastState } from "../../../../shared/types/app";
import { copyText, downloadText } from "../../../../shared/utils/clipboard";
import { slugify } from "../../utils/plot";
import { IconButton } from "../../../../shared/components/ui/IconButton";

export function HtmlPlot({
  plot,
  showToast,
}: {
  plot: PlotSpec;
  showToast: (message: string, tone?: ToastState["tone"]) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const sharePlot = async () => {
    if (navigator.share) {
      await navigator.share({
        title: plot.title,
        text: plot.description,
      });
      showToast("Chart shared");
      return;
    }

    await copyText(plot.html);
    showToast("Chart HTML copied");
  };

  return (
    <section className={`html-plot ${expanded ? "expanded" : ""}`}>
      <div className="plot-toolbar">
        <div>
          <b>{plot.title}</b>
          <span>{plot.description}</span>
        </div>
        <IconButton
          label={expanded ? "Collapse chart" : "Expand chart"}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
        <IconButton
          label="Download chart HTML"
          onClick={() => downloadText(`${slugify(plot.title)}.html`, plot.html, "text/html")}
        >
          <Download />
        </IconButton>
        <IconButton label="Share chart" onClick={sharePlot}>
          <Share2 />
        </IconButton>
      </div>
      <iframe title={plot.title} srcDoc={plot.html} sandbox="allow-scripts" />
    </section>
  );
}
