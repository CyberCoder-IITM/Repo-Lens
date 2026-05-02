import { pgTable, text, serial, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reposTable = pgTable("repos", {
  id: serial("id").primaryKey(),
  repoUrl: text("repo_url").notNull(),
  repoName: text("repo_name").notNull(),
  owner: text("owner").notNull(),
  status: text("status").notNull().default("pending"),
  techStack: json("tech_stack").$type<string[]>(),
  fileCount: integer("file_count"),
  generatedReadme: text("generated_readme"),
  generatedDocstrings: text("generated_docstrings"),
  generatedArchitecture: text("generated_architecture"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRepoSchema = createInsertSchema(reposTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRepo = z.infer<typeof insertRepoSchema>;
export type Repo = typeof reposTable.$inferSelect;
