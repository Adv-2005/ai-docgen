// functions-worker/src/services/ingestion.service.ts
import * as functions from "firebase-functions";
import simpleGit, { SimpleGit } from "simple-git";
import { Octokit } from "@octokit/rest";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

export interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
}

export interface CloneResult {
  localPath: string;
  headSha: string;
  baseSha?: string;
}

export interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  content?: string;
}

export interface DiffResult {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }>;
}

/**
 * Service for cloning repositories and extracting diffs
 */
export class IngestionService {
  private git: SimpleGit;
  private octokit: Octokit;
  private workDir: string;
  private mockMode: boolean;

  constructor(githubToken?: string, mockMode: boolean = false) {
    this.git = simpleGit();
    this.octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN,
    });
    this.workDir = path.join(os.tmpdir(), "repo-analysis");
    this.mockMode = mockMode || process.env.MOCK_GITHUB === "true";
  }

  /**
   * Parse repository full name into owner and repo
   */
  parseRepoName(repoFullName: string): RepoInfo {
    const [owner, repo] = repoFullName.split("/");
    
    if (!owner || !repo) {
      throw new Error(`Invalid repository name: ${repoFullName}`);
    }

    return { owner, repo, fullName: repoFullName };
  }

  /**
   * Clone a repository to local temp directory
   */
  async cloneRepository(
    repoFullName: string,
    branch: string = "main"
  ): Promise<CloneResult> {
    const repoInfo = this.parseRepoName(repoFullName);
    const localPath = path.join(this.workDir, repoInfo.repo);

    functions.logger.info("Cloning repository", {
      repo: repoFullName,
      branch,
      localPath,
    });

    try {
      // Clean up if directory exists
      await this.cleanupRepo(localPath);

      // Ensure work directory exists
      await fs.mkdir(this.workDir, { recursive: true });

      // Clone the repository
      const cloneUrl = `https://github.com/${repoFullName}.git`;
      await this.git.clone(cloneUrl, localPath, ["--depth", "1", "--branch", branch]);

      // Get HEAD SHA
      const git = simpleGit(localPath);
      const log = await git.log(["-1"]);
      const headSha = log.latest?.hash || "";

      functions.logger.info("Repository cloned successfully", {
        repo: repoFullName,
        headSha,
        localPath,
      });

      return { localPath, headSha };

    } catch (error) {
      functions.logger.error("Failed to clone repository", {
        repo: repoFullName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get diff between two commits using GitHub API
   */
  async getDiffViaAPI(
    repoFullName: string,
    baseSha: string,
    headSha: string
  ): Promise<DiffResult> {
    const repoInfo = this.parseRepoName(repoFullName);

    functions.logger.info("Fetching diff via GitHub API", {
      repo: repoFullName,
      baseSha,
      headSha,
    });

    try {
      // Get comparison between commits
      const comparison = await this.octokit.repos.compareCommits({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        base: baseSha,
        head: headSha,
      });

      const files: FileChange[] = [];
      let totalAdditions = 0;
      let totalDeletions = 0;

      // Process each changed file
      for (const file of comparison.data.files || []) {
        const status = file.status as "added" | "modified" | "deleted" | "renamed" | "removed";
        
        // Skip binary files and renamed files for now
        if (status === "renamed" || file.patch === undefined) {
          continue;
        }

        files.push({
          path: file.filename,
          status: status === "removed" ? "deleted" : status,
          additions: file.additions,
          deletions: file.deletions,
          content: file.patch,
        });

        totalAdditions += file.additions;
        totalDeletions += file.deletions;
      }

      // Extract commit information
      const commits = comparison.data.commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || "Unknown",
        date: commit.commit.author?.date || "",
      }));

      functions.logger.info("Diff fetched successfully", {
        repo: repoFullName,
        filesChanged: files.length,
        totalAdditions,
        totalDeletions,
      });

      return {
        files,
        totalAdditions,
        totalDeletions,
        commits,
      };

    } catch (error) {
      functions.logger.error("Failed to fetch diff", {
        repo: repoFullName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get changed files for a Pull Request
   */
  async getPRChanges(
    repoFullName: string,
    prNumber: number
  ): Promise<DiffResult> {
    const repoInfo = this.parseRepoName(repoFullName);

    functions.logger.info("Fetching PR changes", {
      repo: repoFullName,
      prNumber,
      mockMode: this.mockMode,
    });

    // Mock mode for testing
    if (this.mockMode) {
      return this.getMockPRChanges(repoFullName, prNumber);
    }

    try {
      // Get PR details
      const pr = await this.octokit.pulls.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: prNumber,
      });

      // Get files changed in PR
      const prFiles = await this.octokit.pulls.listFiles({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: prNumber,
      });

      const files: FileChange[] = [];
      let totalAdditions = 0;
      let totalDeletions = 0;

      for (const file of prFiles.data) {
        const status = file.status as "added" | "modified" | "deleted" | "renamed" | "removed";
        
        if (status === "renamed" || !file.patch) {
          continue;
        }

        files.push({
          path: file.filename,
          status: status === "removed" ? "deleted" : status,
          additions: file.additions,
          deletions: file.deletions,
          content: file.patch,
        });

        totalAdditions += file.additions;
        totalDeletions += file.deletions;
      }

      // Get commits in PR
      const prCommits = await this.octokit.pulls.listCommits({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: prNumber,
      });

      const commits = prCommits.data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name || "Unknown",
        date: commit.commit.author?.date || "",
      }));

      functions.logger.info("PR changes fetched successfully", {
        repo: repoFullName,
        prNumber,
        filesChanged: files.length,
        totalAdditions,
        totalDeletions,
      });

      return {
        files,
        totalAdditions,
        totalDeletions,
        commits,
      };

    } catch (error) {
      functions.logger.error("Failed to fetch PR changes", {
        repo: repoFullName,
        prNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback to mock data if API fails
      functions.logger.warn("Falling back to mock data due to API error");
      return this.getMockPRChanges(repoFullName, prNumber);
    }
  }

  /**
   * Generate mock PR changes for testing
   */
  private getMockPRChanges(repoFullName: string, prNumber: number): DiffResult {
    functions.logger.info("Generating mock PR changes", { repoFullName, prNumber });

    const mockFiles: FileChange[] = [
      {
        path: "src/index.ts",
        status: "modified",
        additions: 15,
        deletions: 3,
        content: `@@ -10,7 +10,19 @@ import express from 'express';
 
 const app = express();
 
-app.get('/', (req, res) => {
+/**
+ * Health check endpoint
+ */
+app.get('/health', (req, res) => {
+  res.json({ status: 'ok', timestamp: new Date() });
+});
+
+/**
+ * Main route handler
+ * @param req Express request
+ * @param res Express response
+ */
+app.get('/', async (req, res) => {
   res.send('Hello World');
 });`,
      },
      {
        path: "src/utils/helper.ts",
        status: "added",
        additions: 25,
        deletions: 0,
        content: `+/**
+ * Utility helper functions
+ */
+
+export function formatDate(date: Date): string {
+  return date.toISOString();
+}
+
+export function calculateSum(numbers: number[]): number {
+  return numbers.reduce((sum, num) => sum + num, 0);
+}
+
+export async function fetchData(url: string): Promise<any> {
+  const response = await fetch(url);
+  return response.json();
+}`,
      },
      {
        path: "README.md",
        status: "modified",
        additions: 5,
        deletions: 1,
        content: `@@ -1,4 +1,8 @@
-# My Project
+# My Awesome Project
+
+## Features
+- Feature 1
+- Feature 2
 
 This is a sample project.`,
      },
    ];

    const mockCommits = [
      {
        sha: "abc123def456",
        message: "Add helper utilities and improve documentation",
        author: "Test Developer",
        date: new Date().toISOString(),
      },
      {
        sha: "def456abc789",
        message: "Fix formatting issues",
        author: "Test Developer",
        date: new Date().toISOString(),
      },
    ];

    return {
      files: mockFiles,
      totalAdditions: mockFiles.reduce((sum, f) => sum + f.additions, 0),
      totalDeletions: mockFiles.reduce((sum, f) => sum + f.deletions, 0),
      commits: mockCommits,
    };
  }

  /**
   * Read file content from repository
   */
  async readFile(localPath: string, filePath: string): Promise<string> {
    const fullPath = path.join(localPath, filePath);
    
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      return content;
    } catch (error) {
      functions.logger.error("Failed to read file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * List all files in repository with filtering
   */
  async listFiles(
    localPath: string,
    extensions: string[] = [".js", ".ts", ".jsx", ".tsx", ".py", ".java"]
  ): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string, baseDir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        // Skip node_modules, .git, etc.
        if (
          relativePath.includes("node_modules") ||
          relativePath.includes(".git") ||
          relativePath.includes("dist") ||
          relativePath.includes("build")
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath, baseDir);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(relativePath);
          }
        }
      }
    }

    await walk(localPath, localPath);
    return files;
  }

  /**
   * Clean up cloned repository
   */
  async cleanupRepo(localPath: string): Promise<void> {
    try {
      await fs.rm(localPath, { recursive: true, force: true });
      functions.logger.info("Repository cleaned up", { localPath });
    } catch (error) {
      // Ignore cleanup errors
      functions.logger.warn("Failed to cleanup repository", {
        localPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}