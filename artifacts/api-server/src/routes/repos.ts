import { Router } from "express";
import { db } from "@workspace/db";
import { reposTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  AnalyzeRepoBody,
  GetRepoParams,
  GetRepoStatusParams,
} from "@workspace/api-zod";
import { parseGitHubUrl } from "../lib/analyzer.js";
import { runAnalysis } from "../lib/analysis-worker.js";

const router = Router();

// GET /repos - List all repos
router.get("/repos", async (req, res) => {
  try {
    const repos = await db
      .select()
      .from(reposTable)
      .orderBy(desc(reposTable.createdAt))
      .limit(50);
    return res.json(repos);
  } catch (err) {
    req.log.error({ err }, "Failed to list repos");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch repositories" });
  }
});

// GET /repos/stats/summary - Get summary stats
router.get("/repos/stats/summary", async (req, res) => {
  try {
    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where status = 'completed')::int`,
        failed: sql<number>`count(*) filter (where status = 'failed')::int`,
        pending: sql<number>`count(*) filter (where status in ('pending', 'cloning', 'analyzing', 'generating'))::int`,
      })
      .from(reposTable);

    // Extract tech stack frequencies
    const reposWithStack = await db
      .select({ techStack: reposTable.techStack })
      .from(reposTable)
      .where(eq(reposTable.status, "completed"));

    const techCounts: Record<string, number> = {};
    for (const repo of reposWithStack) {
      if (repo.techStack) {
        for (const tech of repo.techStack as string[]) {
          techCounts[tech] = (techCounts[tech] || 0) + 1;
        }
      }
    }

    const popularTechStack = Object.entries(techCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tech, count]) => ({ tech, count }));

    return res.json({
      totalRepos: totals?.total ?? 0,
      completedRepos: totals?.completed ?? 0,
      failedRepos: totals?.failed ?? 0,
      pendingRepos: totals?.pending ?? 0,
      popularTechStack,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get summary");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch summary" });
  }
});

// POST /repos/analyze - Start analysis
router.post("/repos/analyze", async (req, res) => {
  const parsed = AnalyzeRepoBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "validation_error",
      message: "Invalid request body",
    });
  }

  const { repoUrl } = parsed.data;

  try {
    const { owner, repoName } = await parseGitHubUrl(repoUrl);

    const [repo] = await db
      .insert(reposTable)
      .values({
        repoUrl,
        repoName,
        owner,
        status: "pending",
      })
      .returning();

    // Fire and forget — run in background
    setImmediate(() => {
      runAnalysis(repo.id, repoUrl).catch((err) => {
        req.log.error({ err, repoId: repo.id }, "Background analysis failed");
      });
    });

    return res.status(202).json(repo);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start analysis";
    req.log.error({ err }, "Failed to create repo");
    return res.status(400).json({ error: "bad_request", message });
  }
});

// GET /repos/:id - Get a single repo
router.get("/repos/:id", async (req, res) => {
  const parsed = GetRepoParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", message: "Invalid repo ID" });
  }

  try {
    const [repo] = await db
      .select()
      .from(reposTable)
      .where(eq(reposTable.id, parsed.data.id));

    if (!repo) {
      return res.status(404).json({ error: "not_found", message: "Repository not found" });
    }

    return res.json(repo);
  } catch (err) {
    req.log.error({ err }, "Failed to get repo");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch repository" });
  }
});

// GET /repos/:id/status - Poll status
router.get("/repos/:id/status", async (req, res) => {
  const parsed = GetRepoStatusParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation_error", message: "Invalid repo ID" });
  }

  try {
    const [repo] = await db
      .select({
        id: reposTable.id,
        status: reposTable.status,
        errorMessage: reposTable.errorMessage,
      })
      .from(reposTable)
      .where(eq(reposTable.id, parsed.data.id));

    if (!repo) {
      return res.status(404).json({ error: "not_found", message: "Repository not found" });
    }

    const progressMap: Record<string, number> = {
      pending: 5,
      cloning: 20,
      analyzing: 45,
      generating: 75,
      completed: 100,
      failed: 0,
    };

    const stepMap: Record<string, string> = {
      pending: "Queued for analysis...",
      cloning: "Cloning repository...",
      analyzing: "Detecting tech stack and traversing files...",
      generating: "Generating documentation with AI...",
      completed: "Analysis complete",
      failed: "Analysis failed",
    };

    return res.json({
      id: repo.id,
      status: repo.status,
      progress: progressMap[repo.status] ?? 0,
      currentStep: stepMap[repo.status] ?? null,
      errorMessage: repo.errorMessage ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get repo status");
    return res.status(500).json({ error: "internal_error", message: "Failed to fetch status" });
  }
});

export default router;
