// functions-api/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Health check endpoint
export const health = functions.https.onRequest((req, res) => {
  res.json({
    status: "ok",
    service: "ai-docgen-api",
    ts: new Date().toISOString()
  });
});

// GitHub webhook handler
export { githubWebhook } from "./webhooks/github";

// Queue processing
export { processPubSubQueue, retryFailedQueueItems } from "./queue/processor";

// Monitoring and metrics
export {
  trackWebhookMetrics,
  trackJobMetrics,
  generateDailySummary,
  getMetrics
} from "./monitoring/metrics";

// GitHub token retrieval (NEW!)
export { getGitHubToken } from "./github/getGitHubToken";

// Pub/Sub worker for repository analysis
export const analyzeRepo = functions.pubsub
  .topic("analyze-repo")
  .onPublish(async (message: functions.pubsub.Message) => {
    const payload = (message.json as any) || {};
    const jobId = payload.jobId;
    const repoId = payload.repoId || "unknown";
    const prNumber = payload.prNumber ?? null;

    functions.logger.log("analyzeRepo triggered", {
      jobId,
      repoId,
      prNumber,
      payload
    });

    const db = admin.firestore();
    const now = new Date();

    // If jobId is provided, update the job status
    if (jobId) {
      try {
        await db.collection("jobs").doc(jobId).update({
          status: "in-progress",
          startedAt: now,
          updatedAt: now,
        });

        functions.logger.info("Job status updated to in-progress", { jobId });
      } catch (error) {
        functions.logger.error("Failed to update job", {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Create result document
    const resultRef = db.collection("jobResults").doc();
    await resultRef.set({
      jobId: jobId || null,
      repoId,
      prNumber,
      status: "completed",
      note: "Simulated analysis — replace with real logic",
      receivedAt: now,
      resultAt: now,
    });

    // Update job to completed
    if (jobId) {
      await db.collection("jobs").doc(jobId).update({
        status: "completed",
        completedAt: now,
        updatedAt: now,
        resultId: resultRef.id,
      });

      functions.logger.info("Job completed", { jobId, resultId: resultRef.id });
    }

    return { ok: true, jobId, resultId: resultRef.id };
  });