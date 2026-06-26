import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type MermaidNodeAction = {
  nodeId: string;
  onClick: () => void;
};

type MermaidPreviewProps = {
  chart: string;
  title: string;
  className?: string;
  svgMode?: "fit" | "natural";
  resizable?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  nodeActions?: MermaidNodeAction[];
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

const toMermaidRenderId = (title: string): string =>
  `mermaid-${title.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

export const MermaidPreview = ({
  chart,
  title,
  className = "",
  svgMode = "natural",
  resizable = false,
  defaultHeight,
  minHeight = 280,
  maxHeight = 1100,
  nodeActions = [],
}: MermaidPreviewProps) => {
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const suppressClickRef = useRef(false);
  const dragStateRef = useRef<{
    hasMoved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);

  const clampZoom = (value: number): number => Math.min(6, Math.max(0.5, value));

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    let cancelled = false;

    setFailed(false);
    setSvg("");
    resetView();

    const renderChart = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          flowchart: {
            htmlLabels: true,
            useMaxWidth: false,
          },
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
          toMermaidRenderId(title),
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

  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }

    const viewport = viewportRef.current;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const direction = event.deltaY > 0 ? -1 : 1;
      const step = event.ctrlKey ? 0.2 : 0.1;
      setZoom((current) => clampZoom(Number((current + direction * step).toFixed(2))));
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    if (!svgContainerRef.current || nodeActions.length === 0) {
      return;
    }

    const cleanups: Array<() => void> = [];

    nodeActions.forEach(({ nodeId, onClick }) => {
      const svgRoot = svgContainerRef.current;
      if (!svgRoot) {
        return;
      }

      const escapedId =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(nodeId)
          : nodeId.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
      const target =
        svgRoot.querySelector<SVGGElement>(`#${escapedId}`) ??
        svgRoot.querySelector<SVGGElement>(`[data-id="${nodeId}"]`) ??
        svgRoot.querySelector<SVGGElement>(`[id$="${nodeId}"]`) ??
        svgRoot.querySelector<SVGGElement>(`[id*="-${escapedId}-"]`) ??
        svgRoot.querySelector<SVGGElement>(`[id*="${escapedId}"]`);

      if (!target) {
        return;
      }

      target.style.cursor = "pointer";
      target.setAttribute("data-interactive-node", "true");

      const handleClick = () => {
        onClick();
      };

      target.addEventListener("click", handleClick);
      cleanups.push(() => {
        target.removeEventListener("click", handleClick);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [nodeActions, svg]);

  useEffect(() => {
    const svgRoot = svgContainerRef.current;
    if (!svgRoot) {
      return;
    }

    const handleCaptureClick = (event: MouseEvent) => {
      if (!suppressClickRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
    };

    svgRoot.addEventListener("click", handleCaptureClick, true);
    return () => {
      svgRoot.removeEventListener("click", handleCaptureClick, true);
    };
  }, [svg]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    dragStateRef.current = {
      hasMoved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const updateDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;
    const movedEnough = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;
    if (!dragStateRef.current.hasMoved && !movedEnough) {
      return;
    }

    if (!dragStateRef.current.hasMoved) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    dragStateRef.current.hasMoved = true;
    if (!isDragging) {
      setIsDragging(true);
    }

    setPan({
      x: dragStateRef.current.originX + deltaX,
      y: dragStateRef.current.originY + deltaY,
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      suppressClickRef.current = dragStateRef.current.hasMoved;
      if (dragStateRef.current.hasMoved && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragStateRef.current = null;
      setIsDragging(false);
    }
  };

  if (failed) {
    return (
      <div
        className={`${resizable ? "resize-y overflow-auto" : ""} space-y-3 ${className}`.trim()}
        style={resizable ? { height: `${defaultHeight ?? minHeight}px`, minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` } : undefined}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-copper">Mermaid fallback</p>
        <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs text-white">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      className={`${resizable ? "resize-y overflow-auto" : ""} flex min-h-0 flex-col gap-3 rounded-2xl bg-white p-3 ${className}`.trim()}
      style={
        resizable
          ? {
              height: `${defaultHeight ?? minHeight}px`,
              minHeight: `${minHeight}px`,
              maxHeight: `${maxHeight}px`,
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => clampZoom(Number((current - 0.15).toFixed(2))))}
            aria-label="Zoom out"
            title="Zoom out"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate/20 bg-white text-ink shadow-sm transition hover:border-copper/35 hover:bg-mist"
          >
            <span className="relative block h-3.5 w-3.5 rounded-full border-2 border-current">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-current" />
              <span className="absolute -bottom-1 -right-1 h-1.5 w-0.5 rotate-45 bg-current" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setZoom((current) => clampZoom(Number((current + 0.15).toFixed(2))))}
            aria-label="Zoom in"
            title="Zoom in"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate/20 bg-white text-ink shadow-sm transition hover:border-copper/35 hover:bg-mist"
          >
            <span className="relative block h-3.5 w-3.5 rounded-full border-2 border-current">
              <span className="absolute left-1/2 top-1/2 h-0.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-current" />
              <span className="absolute left-1/2 top-1/2 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-current" />
              <span className="absolute -bottom-1 -right-1 h-1.5 w-0.5 rotate-45 bg-current" />
            </span>
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset view"
            title="Reset view"
            className="rounded-lg border border-slate/20 bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm transition hover:border-copper/35 hover:bg-mist"
          >
            Reset
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`min-h-0 flex-1 overflow-auto rounded-2xl bg-white select-none ${
          isDragging ? "cursor-grabbing" : zoom > 1 ? "cursor-grab" : "cursor-default"
        }`}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div
          ref={svgContainerRef}
          className="select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "top left",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
};
