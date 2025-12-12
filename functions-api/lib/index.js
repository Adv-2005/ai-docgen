"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeRepo = exports.getMetrics = exports.generateDailySummary = exports.trackJobMetrics = exports.trackWebhookMetrics = exports.retryFailedQueueItems = exports.processPubSubQueue = exports.githubWebhook = exports.health = void 0;
// functions-api/src/index.ts
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Health check endpoint
exports.health = functions.https.onRequest((req, res) => {
    res.json({
        status: "ok",
        service: "ai-docgen-api",
        ts: new Date().toISOString()
    });
});
// GitHub webhook handler
var github_1 = require("./webhooks/github");
Object.defineProperty(exports, "githubWebhook", { enumerable: true, get: function () { return github_1.githubWebhook; } });
// Queue processing
var processor_1 = require("./queue/processor");
Object.defineProperty(exports, "processPubSubQueue", { enumerable: true, get: function () { return processor_1.processPubSubQueue; } });
Object.defineProperty(exports, "retryFailedQueueItems", { enumerable: true, get: function () { return processor_1.retryFailedQueueItems; } });
// Monitoring and metrics
var metrics_1 = require("./monitoring/metrics");
Object.defineProperty(exports, "trackWebhookMetrics", { enumerable: true, get: function () { return metrics_1.trackWebhookMetrics; } });
Object.defineProperty(exports, "trackJobMetrics", { enumerable: true, get: function () { return metrics_1.trackJobMetrics; } });
Object.defineProperty(exports, "generateDailySummary", { enumerable: true, get: function () { return metrics_1.generateDailySummary; } });
Object.defineProperty(exports, "getMetrics", { enumerable: true, get: function () { return metrics_1.getMetrics; } });
// Pub/Sub worker for repository analysis
exports.analyzeRepo = functions.pubsub
    .topic("analyze-repo")
    .onPublish(async (message) => {
    const payload = message.json || {};
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
        }
        catch (error) {
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
