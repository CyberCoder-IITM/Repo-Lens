import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Skeleton } from "@/components/ui/skeleton";

interface MermaidDiagramProps {
  chart: string;
}

let mermaidInitialized = false;

/** Clean a node label — strips all special chars Mermaid can't handle inside labels */
function cleanLabel(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")      // <br> → space
    .replace(/<[^>]+>/g, "")           // other HTML tags
    .replace(/[(){}[\]<>]/g, "")       // all bracket types
    .replace(/&/g, "and")              // & → and
    .replace(/:/g, " -")               // colons break some parsers → dash
    .replace(/[|"'\\^~`]/g, "")        // other special chars
    .replace(/\s{2,}/g, " ")           // collapse multiple spaces
    .trim();
}

/**
 * Extract the label from a node shape, handling all Mermaid shape types:
 *   A[label]  A(label)  A((label))  A{label}  A>label]  A([label])
 * Returns { label, rest } where rest is anything after the closing bracket.
 */
function extractNodeLabel(after: string): string {
  // Find the first opening bracket character
  const openIdx = after.search(/[\[({>]/);
  if (openIdx === -1) return after.trim();

  const open = after[openIdx];
  const closeMap: Record<string, string> = { "[": "]", "(": ")", "{": "}", ">": "]" };
  const close = closeMap[open] ?? "]";

  // Find the LAST occurrence of the closing character (handles nested brackets)
  const closeIdx = after.lastIndexOf(close);
  if (closeIdx === -1) return after.trim();

  return after.slice(openIdx + 1, closeIdx);
}

function sanitizeChart(input: string): string {
  // Strip markdown code fences
  let chart = input
    .replace(/^```mermaid\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  const lines = chart.split("\n");

  const fixed = lines.map((line) => {
    const trimmed = line.trim();
    const indent = line.slice(0, line.length - line.trimStart().length);

    // Pass-through: blank lines and diagram type declarations
    if (
      !trimmed ||
      trimmed.startsWith("%%") ||
      trimmed.startsWith("graph ") ||
      trimmed.startsWith("flowchart ") ||
      trimmed === "end"
    ) {
      return line;
    }

    // Subgraph lines — strip parentheses, colons, and special chars from the name
    if (trimmed.startsWith("subgraph")) {
      const nameRaw = trimmed.slice("subgraph".length).trim();
      if (!nameRaw) return line; // bare "subgraph" keyword
      const nameCleaned = nameRaw
        .replace(/[(){}[\]<>]/g, "")
        .replace(/:/g, " -")
        .replace(/&/g, "and")
        .replace(/[|"'\\^~`]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      return `${indent}subgraph ${nameCleaned}`;
    }

    // Arrow/edge lines — fix invalid ": label" suffix (e.g. "A --> B: Loads")
    // Valid Mermaid label syntax is "A -- Loads --> B", not "A --> B: Loads"
    const isArrow =
      trimmed.includes("-->") ||
      trimmed.includes("---") ||
      trimmed.includes("-.->") ||
      trimmed.includes("==>");
    if (isArrow) {
      // Convert "A --> B: Label" → "A -- Label --> B"
      const colonLabelFix = line.replace(
        /^(\s*)(.+?)\s*-->\s*([A-Za-z0-9_[\]]+):\s*(.+)$/,
        "$1$2 -- $4 --> $3",
      );
      if (colonLabelFix !== line) return colonLabelFix;
      return line;
    }

    // Node definition: starts with an alphanumeric ID followed by a shape bracket
    const nodeMatch = trimmed.match(/^([A-Za-z0-9_]+)([\[({>].*)$/s);
    if (nodeMatch) {
      const nodeId = nodeMatch[1];
      const rawLabel = extractNodeLabel(nodeMatch[2]);
      const cleanedLabel = cleanLabel(rawLabel);
      return `${indent}${nodeId}[${cleanedLabel}]`;
    }

    return line;
  });

  let result = fixed.join("\n");

  // Balance unclosed subgraphs — count subgraph vs end occurrences and append missing ends
  const subgraphCount = (result.match(/^\s*subgraph\b/gm) ?? []).length;
  const endCount = (result.match(/^\s*end\s*$/gm) ?? []).length;
  const missing = subgraphCount - endCount;
  if (missing > 0) {
    result += "\n" + "end\n".repeat(missing);
  }

  return result;
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
