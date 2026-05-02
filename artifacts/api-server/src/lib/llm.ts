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

export async function generateArchitectureDiagram(params: {
  repoName: string;
  techStack: string[];
  directoryTree: string;
  files: FileInfo[];
}): Promise<string> {
  const fileContext = buildFileContext(params.files, 40000);

  const prompt = `You are a senior software architect. Analyze the following repository and generate a Mermaid.js architecture diagram that shows the high-level structure and data flow.

Repository: ${params.repoName}
Tech Stack: ${params.techStack.join(", ")}

Directory Structure:
\`\`\`
${params.directoryTree}
\`\`\`

Key Source Files:
${fileContext}

Generate a Mermaid diagram (use \`graph TD\` or \`flowchart TD\` syntax) that shows:
- Main system components/modules
- Data flow between components
- External services/integrations (databases, APIs, etc.)
- Key relationships

CRITICAL Mermaid syntax rules — every violation causes a parse error:
- Output ONLY the raw Mermaid diagram code, nothing else — no markdown fences, no prose
- Start with \`graph TD\`
- Node IDs: short alphanumeric only — e.g. A, B, SVC1, DB, API (no spaces, no special chars)
- Node labels: use ONLY square brackets — e.g. \`A[UserService]\`
- FORBIDDEN in node labels: ( ) { } [ ] < > : & | " ' / \\ — use plain words only
- FORBIDDEN in subgraph names: ( ) { } < > : & — use plain words only, e.g. \`subgraph DataProcessing\`
- Arrow labels: use \`A -- label --> B\` or \`A --> B\` only — NEVER \`A --> B: label\`
- Keep it readable: max 15-20 nodes total
- Valid example (follow this pattern exactly):
  graph TD
    subgraph Frontend
      UI[React App]
      Router[Wouter Router]
    end
    subgraph Backend
      API[Express API]
      DB[PostgreSQL]
    end
    UI --> Router
    Router -- HTTP --> API
    API --> DB`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 4096 },
  });

  let diagram = response.text ?? "";
  // Strip any markdown code fences if the model added them
  diagram = diagram.replace(/^```mermaid\n?/m, "").replace(/^```\n?/m, "").replace(/```$/m, "").trim();

  return diagram;
}
