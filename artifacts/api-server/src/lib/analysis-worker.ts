import { db } from "@workspace/db";
import { reposTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import {
  cloneRepo,
  analyzeRepo,
  parseGitHubUrl,
  createTempDir,
  cleanupDir,
} from "./analyzer.js";
import {
  generateReadme,
  generateDocstrings,
  generateArchitectureDiagram,
} from "./llm.js";

type AnalysisStatus = "pending" | "cloning" | "analyzing" | "generating" | "completed" | "failed";

async function updateStatus(
  id: number,
  status: AnalysisStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  await db
    .update(reposTable)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(reposTable.id, id));
}

export async function runAnalysis(repoId: number, repoUrl: string): Promise<void> {
  let tmpDir: string | null = null;

  try {
    const { owner, repoName } = await parseGitHubUrl(repoUrl);

    // Step 1: Cloning
    await updateStatus(repoId, "cloning");
    logger.info({ repoId, repoUrl }, "Cloning repository");
    tmpDir = await createTempDir();
    await cloneRepo(repoUrl, tmpDir);

    // Step 2: Analyzing
    await updateStatus(repoId, "analyzing");
    logger.info({ repoId }, "Analyzing repository structure");
    const analysis = await analyzeRepo(tmpDir);

    await db
      .update(reposTable)
      .set({
        techStack: analysis.techStack,
        fileCount: analysis.fileCount,
        updatedAt: new Date(),
      })
      .where(eq(reposTable.id, repoId));

    // Step 3: Generating docs
    await updateStatus(repoId, "generating");
    logger.info({ repoId }, "Generating documentation with LLM");

    const [readme, docstrings, architecture] = await Promise.all([
      generateReadme({
        repoName,
        owner,
        repoUrl,
        techStack: analysis.techStack,
        fileCount: analysis.fileCount,
        directoryTree: analysis.directoryTree,
        files: analysis.files,
      }),
      generateDocstrings({
        repoName,
        techStack: analysis.techStack,
        files: analysis.files,
      }),
      generateArchitectureDiagram({
        repoName,
        techStack: analysis.techStack,
        directoryTree: analysis.directoryTree,
        files: analysis.files,
      }),
    ]);

    await updateStatus(repoId, "completed", {
      generatedReadme: readme,
      generatedDocstrings: docstrings,
      generatedArchitecture: architecture,
    });

    logger.info({ repoId }, "Analysis completed successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ repoId, err }, "Analysis failed");
    await updateStatus(repoId, "failed", { errorMessage: message }).catch(() => {});
  } finally {
    if (tmpDir) {
      await cleanupDir(tmpDir);
    }
  }
}
