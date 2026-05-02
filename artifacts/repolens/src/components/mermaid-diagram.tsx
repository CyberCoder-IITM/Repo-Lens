import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Skeleton } from "@/components/ui/skeleton";

interface MermaidDiagramProps {
  chart: string;
}

let mermaidInitialized = false;

function sanitizeChart(input: string): string {
  // Strip markdown code fences
  let chart = input
    .replace(/^```mermaid\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  // Replace <br> tags with a space (common LLM mistake in labels)
  chart = chart.replace(/<br\s*\/?>/gi, " ");

  // Remove any remaining HTML tags inside labels
  chart = chart.replace(/<[^>]+>/g, "");

  // Strip parentheses from inside [] labels — e.g. A[Entry (main.py)] → A[Entry main.py]
  chart = chart.replace(/\[([^\]]*)\]/g, (_match, content) => {
    return `[${content.replace(/[()]/g, "")}]`;
  });

  // Strip parentheses and <> from inside {} diamond labels
  chart = chart.replace(/\{([^}]*)\}/g, (_match, content) => {
    return `{${content.replace(/[()<>]/g, "")}}`;
  });

  // Convert remaining round-bracket node shapes to square brackets: A(label) → A[label]
  // This handles cases like C(Env Variables) → C[Env Variables]
  chart = chart.replace(/^(\s*[A-Za-z0-9_]+)\(([^)\n]+)\)/gm, (_match, id, content) => {
    return `${id}[${content.replace(/[()]/g, "")}]`;
  });

  return chart;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function renderDiagram() {
      setLoading(true);
      setError(null);
      setSvg("");

      try {
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "loose",
            themeVariables: {
              primaryColor: "#003333",
              primaryBorderColor: "#00ffff",
              primaryTextColor: "#f8fafc",
              lineColor: "#00cccc",
              secondaryColor: "#001a1a",
              tertiaryColor: "#002222",
              background: "#0a0a0f",
              mainBkg: "#0d1117",
              nodeBorder: "#00ffff",
              clusterBkg: "#0d1117",
              titleColor: "#00ffff",
              edgeLabelBackground: "#0d1117",
              fontFamily: "JetBrains Mono, monospace",
            },
          });
          mermaidInitialized = true;
        }

        const sanitized = sanitizeChart(chart);
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const { svg: svgResult } = await mermaid.render(id, sanitized);

        if (mounted) {
          setSvg(svgResult);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error("Mermaid rendering failed:", err);
          setError("Could not render diagram automatically.");
          setLoading(false);
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

  if (loading && !svg && !error) {
    return <Skeleton className="w-full h-96" />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-md bg-amber-950/30 border border-amber-600/40 text-amber-400 text-sm font-mono">
          Diagram could not be auto-rendered. View the raw Mermaid source below — paste it into{" "}
          <a
            href="https://mermaid.live"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-300"
          >
            mermaid.live
          </a>{" "}
          to visualize it.
        </div>
        <pre className="w-full overflow-x-auto rounded-md border border-border bg-card p-4 text-xs font-mono text-foreground leading-relaxed whitespace-pre-wrap">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto p-4 rounded-md border border-border bg-card flex justify-center items-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
