# RepoLens Workspace

## Overview

pnpm workspace monorepo using TypeScript. RepoLens is a full-stack automated documentation agent for GitHub repositories.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, ShadcnUI, wouter
- **LLM**: Google Gemini via Replit AI Integrations (`@workspace/integrations-gemini-ai`)

## Architecture

### Frontend (`artifacts/repolens`)
- Dark-themed dashboard with electric cyan/teal accent palette
- `/` — Landing page: repo URL input form + stats summary + recent analyses list
- `/repo/:id` — Analysis dashboard: live progress polling, tech stack badges, README, docstrings, and Mermaid architecture diagram tabs
- Libraries: `react-markdown`, `remark-gfm`, `mermaid`

### Backend (`artifacts/api-server`)
- Express API serving all routes under `/api`
- `POST /api/repos/analyze` — clones repo, runs analysis, fires background job
- `GET /api/repos` — list all analyzed repos
- `GET /api/repos/:id` — get repo details
- `GET /api/repos/:id/status` — poll analysis status (pending/cloning/analyzing/generating/completed/failed)
- `GET /api/repos/stats/summary` — aggregate stats

### Analysis Engine (`artifacts/api-server/src/lib/`)
- `analyzer.ts` — GitHub URL parsing, git clone via `simple-git`, file traversal, tech stack detection, directory tree generation
- `llm.ts` — Gemini-powered README generation, docstring generation, Mermaid architecture diagram generation
- `analysis-worker.ts` — Orchestrates the full analysis pipeline in background

### Database (`lib/db`)
- `repos` table: id, repoUrl, repoName, owner, status, techStack (JSON), fileCount, generatedReadme, generatedDocstrings, generatedArchitecture, errorMessage, timestamps

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Environment Variables

- `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — auto-set by Replit database
- `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY` — auto-set by Replit AI Integrations
- `SESSION_SECRET` — session secret

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
