import { useEffect, useState } from "react";

type MermaidPreviewProps = {
  chart: string;
  title: string;
  className?: string;
  svgMode?: "fit" | "natural";
};

const formatSvg = (svg: string, svgMode: "fit" | "natural"): string => {
  if (svgMode === "fit") {
    return svg.replace(
      /<svg\b([^>]*)>/,
      '<svg$1 style="display:block;width:100%;max-width:100%;height:auto;">',
    );
  }

  return svg.replace(
    /<svg\b([^>]*)>/,
    '<svg$1 style="display:block;height:auto;max-width:none;">',
  );
};

export const MermaidPreview = ({
  chart,
  title,
  className = "",
  svgMode = "natural",
}: MermaidPreviewProps) => {
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setFailed(false);
    setSvg("");

    const renderChart = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            primaryColor: "#f4e7cf",
            primaryTextColor: "#081521",
            primaryBorderColor: "#365166",
            lineColor: "#365166",
            secondaryColor: "#eef4f7",
            tertiaryColor: "#ffffff",
          },
        });

        await mermaid.parse(chart, { suppressErrors: false });
        const result = await mermaid.render(
          `mermaid-${title.replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
          chart,
        );

        if (!cancelled) {
          setSvg(formatSvg(result.svg, svgMode));
          setFailed(false);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Mermaid render failed", error);
          setFailed(true);
        }
      }
    };

    void renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, svgMode, title]);

  if (failed) {
    return (
      <div className={`space-y-3 ${className}`.trim()}>
        <p className="text-xs uppercase tracking-[0.2em] text-copper">Mermaid fallback</p>
        <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs text-white">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      className={`overflow-auto rounded-2xl bg-white p-3 ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
