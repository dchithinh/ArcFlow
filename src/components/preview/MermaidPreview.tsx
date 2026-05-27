import { useEffect, useState } from "react";

type MermaidPreviewProps = {
  chart: string;
  title: string;
};

export const MermaidPreview = ({ chart, title }: MermaidPreviewProps) => {
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import("mermaid")
      .then((module) => {
        module.default.initialize({
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

        return module.default.render(
          `mermaid-${title.replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
          chart,
        );
      })
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, title]);

  if (failed) {
    return (
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-copper">Mermaid fallback</p>
        <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs text-white">{chart}</pre>
      </div>
    );
  }

  return <div className="overflow-x-auto rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />;
};
