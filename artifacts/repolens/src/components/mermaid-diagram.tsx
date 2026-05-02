import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Skeleton } from "@/components/ui/skeleton";

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function renderDiagram() {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "hsl(183, 100%, 15%)",
            primaryBorderColor: "hsl(183, 100%, 50%)",
            primaryTextColor: "hsl(0, 0%, 98%)",
            lineColor: "hsl(183, 100%, 30%)",
          },
        });

        // Generate unique ID for the diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: svgResult } = await mermaid.render(id, chart);
        
        if (mounted) {
          setSvg(svgResult);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error("Mermaid rendering failed:", err);
          setError("Failed to render diagram.");
        }
      }
    }

    if (chart) {
      renderDiagram();
    }

    return () => {
      mounted = false;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-md text-destructive font-mono text-sm">
        {error}
      </div>
    );
  }

  if (!svg) {
    return <Skeleton className="w-full h-96" />;
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto p-4 rounded-md border bg-card flex justify-center items-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
