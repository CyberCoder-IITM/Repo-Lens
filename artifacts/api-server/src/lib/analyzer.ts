import { simpleGit } from "simple-git";
import { glob } from "glob";
import path from "path";
import fs from "fs/promises";
import os from "os";

export interface FileInfo {
  path: string;
  content: string;
  size: number;
}

export interface RepoAnalysis {
  techStack: string[];
  fileCount: number;
  files: FileInfo[];
  repoName: string;
  owner: string;
  directoryTree: string;
}

const TECH_STACK_INDICATORS: Record<string, string[]> = {
  TypeScript: ["tsconfig.json", "*.ts", "*.tsx"],
  JavaScript: ["*.js", "*.jsx", "*.mjs"],
  Python: ["*.py", "requirements.txt", "pyproject.toml", "setup.py"],
  Rust: ["Cargo.toml", "*.rs"],
  Go: ["go.mod", "*.go"],
  Java: ["pom.xml", "build.gradle", "*.java"],
  "C++": ["*.cpp", "*.cc", "*.cxx", "CMakeLists.txt"],
  C: ["*.c", "*.h"],
  "C#": ["*.cs", "*.csproj"],
  Ruby: ["Gemfile", "*.rb"],
  PHP: ["composer.json", "*.php"],
  Swift: ["Package.swift", "*.swift"],
  Kotlin: ["*.kt", "build.gradle.kts"],
  Docker: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"],
  "GitHub Actions": [".github/workflows/*.yml", ".github/workflows/*.yaml"],
  React: ["package.json"],
  Vue: ["package.json"],
  Next: ["next.config.*"],
  Express: ["package.json"],
  FastAPI: ["*.py"],
  Django: ["manage.py", "settings.py"],
  Flask: ["app.py", "*.py"],
  PostgreSQL: ["*.sql", "drizzle.config.*"],
  MongoDB: ["package.json"],
  Redis: ["package.json"],
  Tailwind: ["tailwind.config.*"],
  GraphQL: ["*.graphql", "*.gql", "schema.graphql"],
  Prisma: ["schema.prisma"],
  Drizzle: ["drizzle.config.*"],
};

const PACKAGE_TECH_MAP: Record<string, string> = {
  react: "React",
  vue: "Vue",
  "next": "Next.js",
  nuxt: "Nuxt.js",
  express: "Express",
  fastify: "Fastify",
  "@nestjs/core": "NestJS",
  mongoose: "MongoDB",
  redis: "Redis",
  tailwindcss: "Tailwind",
  prisma: "Prisma",
  "drizzle-orm": "Drizzle",
  graphql: "GraphQL",
  "apollo-server": "Apollo",
  stripe: "Stripe",
  svelte: "Svelte",
  angular: "Angular",
  "@angular/core": "Angular",
};

const MAX_FILE_SIZE = 50 * 1024;
const MAX_FILES_FOR_LLM = 30;

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".cpp", ".cc", ".c", ".h",
  ".cs", ".rb", ".php", ".swift", ".kt", ".kts",
  ".vue", ".svelte", ".astro",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".svn", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", "target", "vendor",
  ".idea", ".vscode", "coverage", ".nyc_output", "out",
]);

export async function parseGitHubUrl(repoUrl: string): Promise<{ owner: string; repoName: string }> {
  const cleanUrl = repoUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleanUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/);
  if (!match) {
    throw new Error("Invalid GitHub URL. Expected format: https://github.com/owner/repo");
  }
  return { owner: match[1], repoName: match[2] };
}

export async function cloneRepo(repoUrl: string, targetDir: string): Promise<void> {
  const git = simpleGit();
  const cleanUrl = repoUrl.trim().replace(/\.git$/, "") + ".git";
  await git.clone(cleanUrl, targetDir, ["--depth=1", "--single-branch"]);
}

export async function analyzeRepo(repoDir: string): Promise<RepoAnalysis> {
  const { owner, repoName } = await parseGitHubUrl(
    // derive from path
    path.basename(path.dirname(repoDir)) + "/" + path.basename(repoDir)
  ).catch(() => ({ owner: "unknown", repoName: path.basename(repoDir) }));

  const techStack = await detectTechStack(repoDir);
  const { files, fileCount } = await collectFiles(repoDir);
  const directoryTree = await buildDirectoryTree(repoDir, 3);

  return {
    techStack,
    fileCount,
    files,
    repoName,
    owner,
    directoryTree,
  };
}

async function detectTechStack(repoDir: string): Promise<string[]> {
  const detected = new Set<string>();

  // Check for package.json (Node.js/JS ecosystem)
  try {
    const pkgPath = path.join(repoDir, "package.json");
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    for (const [dep, tech] of Object.entries(PACKAGE_TECH_MAP)) {
      if (dep in allDeps) {
        detected.add(tech);
      }
    }
    // Check for TypeScript
    if ("typescript" in allDeps || "tsconfig.json" in allDeps) {
      detected.add("TypeScript");
    }
  } catch {
    // No package.json
  }

  // File-extension based detection
  try {
    const allFiles = await glob("**/*", {
      cwd: repoDir,
      ignore: [...IGNORE_DIRS].map((d) => `**/${d}/**`),
      nodir: true,
    });

    const extCounts: Record<string, number> = {};
    for (const f of allFiles) {
      const ext = path.extname(f).toLowerCase();
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }

    if ((extCounts[".ts"] || 0) + (extCounts[".tsx"] || 0) > 0) detected.add("TypeScript");
    if ((extCounts[".py"] || 0) > 0) detected.add("Python");
    if ((extCounts[".rs"] || 0) > 0) detected.add("Rust");
    if ((extCounts[".go"] || 0) > 0) detected.add("Go");
    if ((extCounts[".java"] || 0) > 0) detected.add("Java");
    if ((extCounts[".cpp"] || 0) + (extCounts[".cc"] || 0) > 0) detected.add("C++");
    if ((extCounts[".cs"] || 0) > 0) detected.add("C#");
    if ((extCounts[".rb"] || 0) > 0) detected.add("Ruby");
    if ((extCounts[".php"] || 0) > 0) detected.add("PHP");
    if ((extCounts[".swift"] || 0) > 0) detected.add("Swift");
    if ((extCounts[".kt"] || 0) > 0) detected.add("Kotlin");
    if ((extCounts[".graphql"] || 0) + (extCounts[".gql"] || 0) > 0) detected.add("GraphQL");

    // Check for special config files
    for (const f of allFiles) {
      const basename = path.basename(f);
      const dir = path.dirname(f);
      if (basename === "Dockerfile" || basename === "docker-compose.yml" || basename === "docker-compose.yaml") {
        detected.add("Docker");
      }
      if (dir.includes(".github/workflows")) detected.add("GitHub Actions");
      if (basename === "next.config.js" || basename === "next.config.ts" || basename === "next.config.mjs") detected.add("Next.js");
      if (basename.startsWith("tailwind.config")) detected.add("Tailwind");
      if (basename === "schema.prisma") detected.add("Prisma");
      if (basename === "drizzle.config.ts" || basename === "drizzle.config.js") detected.add("Drizzle");
      if (basename === "manage.py") detected.add("Django");
      if (basename === "Cargo.toml") detected.add("Rust");
      if (basename === "go.mod") detected.add("Go");
      if (basename === "Gemfile") detected.add("Ruby/Rails");
    }
  } catch {
    // continue
  }

  return Array.from(detected);
}

async function collectFiles(repoDir: string): Promise<{ files: FileInfo[]; fileCount: number }> {
  const allFiles = await glob("**/*", {
    cwd: repoDir,
    ignore: [...IGNORE_DIRS].map((d) => `**/${d}/**`),
    nodir: true,
  });

  const codeFiles = allFiles.filter((f) => CODE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  const fileCount = allFiles.length;

  // Pick most important files for LLM context
  const prioritized = prioritizeFiles(codeFiles);
  const selected = prioritized.slice(0, MAX_FILES_FOR_LLM);

  const files: FileInfo[] = [];
  for (const f of selected) {
    try {
      const fullPath = path.join(repoDir, f);
      const stat = await fs.stat(fullPath);
      if (stat.size > MAX_FILE_SIZE) continue;
      const content = await fs.readFile(fullPath, "utf-8");
      files.push({ path: f, content, size: stat.size });
    } catch {
      // skip unreadable files
    }
  }

  return { files, fileCount };
}

function prioritizeFiles(files: string[]): string[] {
  const priority = (f: string): number => {
    const base = path.basename(f).toLowerCase();
    if (base === "readme.md") return 0;
    if (base === "main.ts" || base === "main.py" || base === "main.go" || base === "main.rs") return 1;
    if (base === "index.ts" || base === "index.js" || base === "app.ts" || base === "app.py") return 2;
    if (base.includes("config")) return 3;
    if (path.extname(f) === ".ts" || path.extname(f) === ".tsx") return 4;
    if (path.extname(f) === ".py") return 5;
    return 10;
  };
  return [...files].sort((a, b) => priority(a) - priority(b));
}

async function buildDirectoryTree(dir: string, maxDepth: number, currentDepth = 0, prefix = ""): Promise<string> {
  if (currentDepth >= maxDepth) return "";

  let result = "";
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const filtered = entries
      .filter((e) => !IGNORE_DIRS.has(e.name) && !e.name.startsWith("."))
      .slice(0, 20);

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const isLast = i === filtered.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = prefix + (isLast ? "    " : "│   ");

      result += prefix + connector + entry.name + "\n";

      if (entry.isDirectory() && currentDepth < maxDepth - 1) {
        result += await buildDirectoryTree(
          path.join(dir, entry.name),
          maxDepth,
          currentDepth + 1,
          childPrefix
        );
      }
    }
  } catch {
    // skip
  }
  return result;
}

export async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "repolens-"));
}

export async function cleanupDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}
