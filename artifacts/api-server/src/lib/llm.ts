import { ai } from "@workspace/integrations-gemini-ai";
import type { FileInfo } from "./analyzer.js";

const MODEL = "gemini-2.5-flash";

function buildFileContext(files: FileInfo[], maxChars = 80000): string {
  let context = "";
  for (const file of files) {
    const block = `\n### File: ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
    if (context.length + block.length > maxChars) break;
    context += block;
  }
  return context;
}

export async function generateReadme(params: {
  repoName: string;
  owner: string;
  repoUrl: string;
  techStack: string[];
  fileCount: number;
  directoryTree: string;
  files: FileInfo[];
}): Promise<string> {
  const fileContext = buildFileContext(params.files);

  const prompt = `You are a senior software engineer. Analyze the following GitHub repository and generate a comprehensive, professional README.md.

Repository: ${params.owner}/${params.repoName}
URL: ${params.repoUrl}
Tech Stack: ${params.techStack.join(", ")}
Total Files: ${params.fileCount}

Directory Structure:
\`\`\`
${params.directoryTree}
\`\`\`

Key Files:
${fileContext}

Generate a README.md that includes:
1. Project title and concise description
2. Key features (bullet points based on what you can infer from the code)
3. Tech stack / built with section
4. Prerequisites and installation instructions
5. Usage examples
6. Project structure overview
7. Contributing guidelines (standard template)
8. License section

Be specific and accurate. Base everything on the actual code, not generic templates.
Output ONLY the markdown content, no extra commentary.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192 },
  });

  return response.text ?? "";
}

export async function generateDocstrings(params: {
  repoName: string;
  techStack: string[];
  files: FileInfo[];
}): Promise<string> {
  const fileContext = buildFileContext(params.files, 60000);

  const prompt = `You are a senior software engineer. Analyze the following source code and generate comprehensive technical documentation with docstrings for all major functions, classes, and modules.

Repository: ${params.repoName}
Tech Stack: ${params.techStack.join(", ")}

Source Code:
${fileContext}

Generate documentation in this format:
- For each major file, add a module-level docstring explaining its purpose
- For each class/function/method, add a docstring with: description, parameters (with types), return value, and usage example where relevant
- Use the appropriate docstring format for the language (JSDoc for JS/TS, Python docstrings, Rustdoc for Rust, etc.)
- Focus on the most important/complex parts of the codebase

Output the documentation as formatted text with clear file sections. Use proper code blocks with language hints.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192 },
  });

  return response.text ?? "";
}

// ── Server-side Mermaid sanitizer (runs before DB storage) ───────────────────

function cleanMermaidLabel(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[(){}[\]<>&:|"'\\^~`]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 60);
}

function cleanSubgraphName(raw: string): string {
  return raw
    .replace(/[(){}[\]<>&:|"'\\^~`]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 40);
}

function extractMermaidLabel(after: string): string {
  const openIdx = after.search(/[\[({>]/);
  if (openIdx === -1) return after.trim();
  const open = after[openIdx];
  const closeMap: Record<string, string> = { "[": "]", "(": ")", "{": "}", ">": "]" };
  const close = closeMap[open] ?? "]";
  const closeIdx = after.lastIndexOf(close);
  if (closeIdx === -1) return after.trim();
  return after.slice(openIdx + 1, closeIdx);
}

function sanitizeMermaidDiagram(raw: string): string {
  // Strip markdown fences
  let text = raw
    .replace(/^```mermaid\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  const lines = text.split("\n");

  const fixed = lines
    .filter((line) => {
      const t = line.trim();
      // Drop style, classDef, class, click, linkStyle — these can contain
      // hex colours and special chars that trip up the parser
      if (/^(style|classDef|class|click|linkStyle)\s/.test(t)) return false;
      return true;
    })
    .map((line) => {
      const trimmed = line.trim();
      const indent = line.slice(0, line.length - line.trimStart().length);

      if (
        !trimmed ||
        trimmed.startsWith("%%") ||
        trimmed.startsWith("graph ") ||
        trimmed.startsWith("flowchart ") ||
        trimmed === "end"
      ) {
        return line;
      }

      // Subgraph: clean the name
      if (trimmed.startsWith("subgraph")) {
        const nameRaw = trimmed.slice("subgraph".length).trim();
        if (!nameRaw) return line;
        return `${indent}subgraph ${cleanSubgraphName(nameRaw)}`;
      }

      // Arrow lines: strip ": suffix" and parens from labels
      const isArrow =
        trimmed.includes("-->") ||
        trimmed.includes("---") ||
        trimmed.includes("-.->") ||
        trimmed.includes("==>");
      if (isArrow) {
        let fixed = line;
        // Remove ": trailing text" after destination node
        fixed = fixed.replace(
          /(\s*-->\s*[A-Za-z0-9_]+)\s*:\s*[^\n]+$/,
          "$1",
        );
        // Remove parenthesised groups from inline arrow labels: -- text (stuff) -->
        fixed = fixed.replace(/\([^)]*\)/g, "");
        // Remove stray colons
        fixed = fixed.replace(/(?<=\s):\s*/g, "");
        return fixed.trimEnd();
      }

      // Node definition
      const nodeMatch = trimmed.match(/^([A-Za-z0-9_]+)([\[({>].*)$/s);
      if (nodeMatch) {
        const nodeId = nodeMatch[1];
        const rawLabel = extractMermaidLabel(nodeMatch[2]);
        return `${indent}${nodeId}[${cleanMermaidLabel(rawLabel)}]`;
      }

      return line;
    });

  let result = fixed.join("\n");

  // Balance unclosed subgraphs
  const sgCount = (result.match(/^\s*subgraph\b/gm) ?? []).length;
  const endCount = (result.match(/^\s*end\s*$/gm) ?? []).length;
  const missing = sgCount - endCount;
  if (missing > 0) result += "\n" + "end\n".repeat(missing);

  return result;
}

// ── Types for the structured diagram JSON the LLM returns ───────────────────

interface DiagramNode {
  id: string;
  label: string;
}

interface DiagramSubgraph {
  name: string;
  nodes: DiagramNode[];
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

interface DiagramJson {
  subgraphs?: DiagramSubgraph[];
  nodes?: DiagramNode[];
  edges?: DiagramEdge[];
}

// ── Safe string helpers ───────────────────────────────────────────────────────

function safeId(raw: string): string {
  // Keep only alphanumeric + underscore, ensure it starts with a letter
  const clean = raw.replace(/[^a-zA-Z0-9_]/g, "");
  return /^[a-zA-Z]/.test(clean) ? clean : "N" + clean;
}

function safeLabel(raw: string): string {
  return raw
    .replace(/[[\](){}|"'<>&:]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 60); // cap length for readability
}

function safeName(raw: string): string {
  return raw
    .replace(/[[\](){}|"'<>&:]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 40);
}

// ── Convert structured JSON → valid Mermaid ───────────────────────────────────

function buildMermaidFromJson(data: DiagramJson): string {
  const lines: string[] = ["graph TD"];

  for (const sg of data.subgraphs ?? []) {
    lines.push(`  subgraph ${safeName(sg.name)}`);
    for (const node of sg.nodes ?? []) {
      lines.push(`    ${safeId(node.id)}[${safeLabel(node.label)}]`);
    }
    lines.push("  end");
  }

  for (const node of data.nodes ?? []) {
    lines.push(`  ${safeId(node.id)}[${safeLabel(node.label)}]`);
  }

  for (const edge of data.edges ?? []) {
    const from = safeId(edge.from);
    const to = safeId(edge.to);
    if (edge.label) {
      lines.push(`  ${from} -- ${safeLabel(edge.label)} --> ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return lines.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateArchitectureDiagram(params: {
  repoName: string;
  techStack: string[];
  directoryTree: string;
  files: FileInfo[];
}): Promise<string> {
  const fileContext = buildFileContext(params.files, 40000);

  const prompt = `You are a senior software architect. Analyze the following repository and return a JSON object describing the system architecture.

Repository: ${params.repoName}
Tech Stack: ${params.techStack.join(", ")}

Directory Structure:
\`\`\`
${params.directoryTree}
\`\`\`

Key Source Files:
${fileContext}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "subgraphs": [
    {
      "name": "Frontend",
      "nodes": [
        { "id": "UI", "label": "React App" },
        { "id": "Router", "label": "Client Router" }
      ]
    },
    {
      "name": "Backend",
      "nodes": [
        { "id": "API", "label": "Express API" },
        { "id": "DB", "label": "PostgreSQL" }
      ]
    }
  ],
  "nodes": [
    { "id": "EXT", "label": "External API" }
  ],
  "edges": [
    { "from": "UI", "to": "Router" },
    { "from": "Router", "to": "API", "label": "HTTP" },
    { "from": "API", "to": "DB" },
    { "from": "API", "to": "EXT", "label": "REST" }
  ]
}

Rules:
- "subgraphs": logical groups of related components (e.g. Frontend, Backend, Database, External Services)
- "nodes": standalone components not in any subgraph
- "edges": data flow connections between node IDs
- node "id" values: short alphanumeric, no spaces (e.g. "API", "DB", "AuthSvc")
- node "label" values: plain English description, no special characters
- edge "label": optional, short verb phrase (e.g. "HTTP", "SQL", "WebSocket")
- max 15-20 nodes total across all subgraphs and standalone nodes
- ALL node IDs used in edges must exist in subgraphs or nodes`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096 },
  });

  const raw = (response.text ?? "").trim();

  // Extract JSON — strip any accidental markdown fences
  const jsonText = raw
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  try {
    const data: DiagramJson = JSON.parse(jsonText);
    // JSON path — programmatically built Mermaid, already clean
    return buildMermaidFromJson(data);
  } catch {
    // Fallback: model returned raw Mermaid — sanitize it before storing
    return sanitizeMermaidDiagram(jsonText);
  }
}
