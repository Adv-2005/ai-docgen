// functions-worker/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { IngestionService } from "./services/ingestion.service";
import { AnalysisService } from "./services/analysis.services";
import { toFirestoreData } from "./utils/firestore";

admin.initializeApp();

const FieldValue = admin.firestore.FieldValue;

/**
 * Main worker function for repository analysis
 * Triggered by Pub/Sub topic: analyze-repo
 */
export const analyzeRepoWorker = functions.pubsub
  .topic("analyze-repo")
  .onPublish(async (message) => {
    const payload = message.json as any;
    const { jobId, jobType, repoId, prNumber, changedFiles } = payload;

    functions.logger.info("Worker started", {
      jobId,
      jobType,
      repoId,
      prNumber,
    });

    const db = admin.firestore();
    const startTime = Date.now();

    try {
      // Update job status to in-progress
      if (jobId) {
        await db.collection("jobs").doc(jobId).update({
          status: "in-progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Get job details from Firestore
      const jobDoc = await db.collection("jobs").doc(jobId).get();
      const jobData = jobDoc.data();

      if (!jobData) {
        throw new Error(`Job ${jobId} not found`);
      }

      const repoFullName = jobData.repoFullName;
      
      // Enable mock mode for emulator/testing (no GitHub token)
      const mockMode = !process.env.GITHUB_TOKEN || process.env.MOCK_GITHUB === "true";
      const ingestionService = new IngestionService(undefined, mockMode);
      const analysisService = new AnalysisService();

      let analysisResult: any = {};

      // Process based on job type
      switch (jobType) {
        case "pr-analysis":
          analysisResult = await processPRAnalysis(
            ingestionService,
            analysisService,
            repoFullName,
            prNumber
          );
          break;

        case "push-analysis":
          analysisResult = await processPushAnalysis(
            ingestionService,
            analysisService,
            repoFullName,
            changedFiles || []
          );
          break;

        case "initial-ingestion":
          analysisResult = await processInitialIngestion(
            ingestionService,
            analysisService,
            repoFullName
          );
          break;

        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      const processingTime = Date.now() - startTime;

      // Store results (clean undefined values for Firestore)
      const resultRef = db.collection("jobResults").doc();
      await resultRef.set(toFirestoreData({
        jobId,
        repoId,
        prNumber: prNumber || null,
        status: "completed",
        analysis: analysisResult,
        processingTimeMs: processingTime,
        createdAt: new Date(),
      }));

      // Update job to completed
      if (jobId) {
        await db.collection("jobs").doc(jobId).update({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
          resultId: resultRef.id,
          processingTimeMs: processingTime,
        });
      }

      functions.logger.info("Worker completed", {
        jobId,
        resultId: resultRef.id,
        processingTimeMs: processingTime,
      });

      return { success: true, jobId, resultId: resultRef.id };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      functions.logger.error("Worker failed", {
        jobId,
        error: errorMessage,
      });

      // Update job to failed
      if (jobId) {
        await db.collection("jobs").doc(jobId).update({
          status: "failed",
          error: errorMessage,
          updatedAt: new Date(),
        });
      }

      throw error;
    }
  });

/**
 * Process PR analysis
 */
async function processPRAnalysis(
  ingestionService: IngestionService,
  analysisService: AnalysisService,
  repoFullName: string,
  prNumber: number
) {
  functions.logger.info("Processing PR analysis", { repoFullName, prNumber });

  // Get PR changes via GitHub API
  const diffResult = await ingestionService.getPRChanges(repoFullName, prNumber);

  const analysisResults = [];

  // Analyze each changed file
  for (const file of diffResult.files) {
    if (file.status === "deleted") {
      analysisResults.push({
        filePath: file.path,
        status: "deleted",
        language: "unknown",
      });
      continue;
    }

    try {
      // For modified/added files, analyze the content
      // Note: GitHub API provides patch, not full content
      // For full analysis, we'd need to clone the repo
      const fileAnalysis = await analysisService.analyzeFile(
        file.path,
        file.content || ""
      );

      analysisResults.push({
        ...fileAnalysis,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      });

    } catch (error) {
      functions.logger.warn("Failed to analyze file", {
        file: file.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    type: "pr-analysis",
    prNumber,
    filesChanged: diffResult.files.length,
    totalAdditions: diffResult.totalAdditions,
    totalDeletions: diffResult.totalDeletions,
    commits: diffResult.commits,
    files: analysisResults,
  };
}

/**
 * Process push analysis
 */
async function processPushAnalysis(
  ingestionService: IngestionService,
  analysisService: AnalysisService,
  repoFullName: string,
  changedFiles: string[]
) {
  functions.logger.info("Processing push analysis", {
    repoFullName,
    filesCount: changedFiles.length,
  });

  // For push events, analyze the changed files
  // In mock mode, we'll generate mock content
  const analysisResults = [];

  for (const filePath of changedFiles) {
    try {
      // Generate mock content based on file extension
      const mockContent = generateMockFileContent(filePath);
      const fileAnalysis = await analysisService.analyzeFile(filePath, mockContent);

      analysisResults.push(fileAnalysis);

    } catch (error) {
      functions.logger.warn("Failed to analyze file", {
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    type: "push-analysis",
    filesChanged: changedFiles.length,
    headSha: "mock-sha-" + Date.now(),
    files: analysisResults,
  };
}

/**
 * Generate mock file content for testing
 */
function generateMockFileContent(filePath: string): string {
  const ext = filePath.split(".").pop();

  if (ext === "ts" || ext === "js") {
    return `// ${filePath}
import express from 'express';

/**
 * Main application class
 */
export class App {
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    console.log(\`Server starting on port \${this.port}\`);
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    console.log('Server stopping');
  }
}

export default new App();
`;
  } else if (ext === "md") {
    return `# ${filePath}

## Overview
This is a documentation file.

## Features
- Feature 1
- Feature 2
`;
  }

  return `// Mock content for ${filePath}`;
}

/**
 * Process initial repository ingestion
 */
async function processInitialIngestion(
  ingestionService: IngestionService,
  analysisService: AnalysisService,
  repoFullName: string
) {
  functions.logger.info("Processing initial ingestion", { repoFullName });

  // Clone the entire repository
  const cloneResult = await ingestionService.cloneRepository(repoFullName);

  // List all relevant files
  const files = await ingestionService.listFiles(cloneResult.localPath);

  functions.logger.info("Files discovered", {
    repoFullName,
    fileCount: files.length,
  });

  const analysisResults = [];

  // Analyze each file (limit to first 50 for demo)
  const filesToAnalyze = files.slice(0, 50);

  for (const filePath of filesToAnalyze) {
    try {
      const content = await ingestionService.readFile(cloneResult.localPath, filePath);
      const fileAnalysis = await analysisService.analyzeFile(filePath, content);

      analysisResults.push(fileAnalysis);

    } catch (error) {
      functions.logger.warn("Failed to analyze file", {
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Cleanup
  await ingestionService.cleanupRepo(cloneResult.localPath);

  return {
    type: "initial-ingestion",
    totalFiles: files.length,
    analyzedFiles: analysisResults.length,
    headSha: cloneResult.headSha,
    files: analysisResults,
  };
}