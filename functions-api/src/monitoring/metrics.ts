// functions-api/src/monitoring/metrics.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Track webhook events metrics
 */
export const trackWebhookMetrics = functions.firestore
  .document("webhookEvents/{eventId}")
  .onCreate(async (snapshot) => {
    const event = snapshot.data();
    const db = admin.firestore();
    
    const date = new Date();
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const hour = date.getHours();
    
    // Aggregate metrics by day
    const metricsRef = db.collection("metrics").doc(`webhooks-${dateKey}`);
    
    await metricsRef.set(
      {
        date: dateKey,
        totalEvents: admin.firestore.FieldValue.increment(1),
        [`eventTypes.${event.event}`]: admin.firestore.FieldValue.increment(1),
        [`hourly.${hour}`]: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    
    functions.logger.info("Webhook metrics updated", { dateKey, eventType: event.event });
  });

/**
 * Track job completion metrics
 */
export const trackJobMetrics = functions.firestore
  .document("jobs/{jobId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only track when job moves to completed or failed
    if (before.status === after.status) return;
    if (after.status !== "completed" && after.status !== "failed") return;
    
    const db = admin.firestore();
    const date = new Date();
    const dateKey = date.toISOString().split("T")[0];
    
    // Calculate processing time
    let processingTimeMs = 0;
    if (after.startedAt && after.completedAt) {
      const startTime = after.startedAt.toDate ? after.startedAt.toDate() : new Date(after.startedAt);
      const endTime = after.completedAt.toDate ? after.completedAt.toDate() : new Date(after.completedAt);
      processingTimeMs = endTime.getTime() - startTime.getTime();
    }
    
    const metricsRef = db.collection("metrics").doc(`jobs-${dateKey}`);
    
    const updateData: any = {
      date: dateKey,
      totalJobs: admin.firestore.FieldValue.increment(1),
      [`jobTypes.${after.jobType}`]: admin.firestore.FieldValue.increment(1),
      [`statuses.${after.status}`]: admin.firestore.FieldValue.increment(1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Track processing times
    if (processingTimeMs > 0) {
      updateData.totalProcessingTimeMs = admin.firestore.FieldValue.increment(processingTimeMs);
      updateData.processedJobsCount = admin.firestore.FieldValue.increment(1);
    }
    
    await metricsRef.set(updateData, { merge: true });
    
    functions.logger.info("Job metrics updated", { 
      dateKey, 
      jobType: after.jobType, 
      status: after.status,
      processingTimeMs 
    });
  });

/**
 * Generate daily summary report
 * Runs at midnight every day
 */
export const generateDailySummary = functions.pubsub
  .schedule("0 0 * * *") // Midnight every day
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateKey = yesterday.toISOString().split("T")[0];
    
    functions.logger.info("Generating daily summary", { dateKey });
    
    try {
      // Fetch metrics
      const webhookMetrics = await db.collection("metrics").doc(`webhooks-${dateKey}`).get();
      const jobMetrics = await db.collection("metrics").doc(`jobs-${dateKey}`).get();
      
      const webhookData = webhookMetrics.data() || {};
      const jobData = jobMetrics.data() || {};
      
      // Calculate averages
      const avgProcessingTime = jobData.processedJobsCount > 0
        ? jobData.totalProcessingTimeMs / jobData.processedJobsCount
        : 0;
      
      const successRate = jobData.totalJobs > 0
        ? ((jobData.statuses?.completed || 0) / jobData.totalJobs) * 100
        : 0;
      
      // Create summary document
      const summary = {
        date: dateKey,
        webhooks: {
          total: webhookData.totalEvents || 0,
          byType: webhookData.eventTypes || {},
        },
        jobs: {
          total: jobData.totalJobs || 0,
          byType: jobData.jobTypes || {},
          byStatus: jobData.statuses || {},
          successRate: Math.round(successRate * 100) / 100,
          avgProcessingTimeMs: Math.round(avgProcessingTime),
        },
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await db.collection("dailySummaries").doc(dateKey).set(summary);
      
      functions.logger.info("Daily summary generated", { 
        dateKey, 
        webhookTotal: summary.webhooks.total,
        jobTotal: summary.jobs.total,
        successRate: summary.jobs.successRate,
      });
      
      return summary;
      
    } catch (error) {
      functions.logger.error("Failed to generate daily summary", {
        dateKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

/**
 * HTTP endpoint to get current metrics
 */
export const getMetrics = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  
  try {
    const db = admin.firestore();
    const today = new Date().toISOString().split("T")[0];
    
    // Get today's metrics
    const [webhookMetrics, jobMetrics, recentJobs] = await Promise.all([
      db.collection("metrics").doc(`webhooks-${today}`).get(),
      db.collection("metrics").doc(`jobs-${today}`).get(),
      db.collection("jobs")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get(),
    ]);
    
    const webhookData = webhookMetrics.data() || {};
    const jobData = jobMetrics.data() || {};
    
    // Get last 7 days summaries
    const summariesSnapshot = await db.collection("dailySummaries")
      .orderBy("date", "desc")
      .limit(7)
      .get();
    
    const summaries = summariesSnapshot.docs.map(doc => doc.data());
    
    res.json({
      success: true,
      date: today,
      current: {
        webhooks: {
          total: webhookData.totalEvents || 0,
          byType: webhookData.eventTypes || {},
        },
        jobs: {
          total: jobData.totalJobs || 0,
          byStatus: jobData.statuses || {},
          successRate: jobData.totalJobs > 0
            ? Math.round(((jobData.statuses?.completed || 0) / jobData.totalJobs) * 100)
            : 0,
        },
      },
      recent: {
        jobs: recentJobs.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })),
      },
      history: summaries,
    });
    
  } catch (error) {
    functions.logger.error("Failed to fetch metrics", {
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch metrics",
    });
  }
});