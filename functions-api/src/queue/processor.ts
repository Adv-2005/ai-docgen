// functions-api/src/queue/processor.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// We'll import Pub/Sub only when NOT in emulator mode
let PubSub: any;
let pubsubClient: any;

/**
 * Initialize Pub/Sub client based on environment
 */
function initializePubSub() {
  if (pubsubClient) return pubsubClient;

  try {
    // Dynamic import to handle emulator vs production
    const { PubSub: PubSubClient } = require("@google-cloud/pubsub");
    
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    
    if (isEmulator) {
      // Emulator configuration
      pubsubClient = new PubSubClient({
        projectId: process.env.GCLOUD_PROJECT || "ai-docgen-44b16",
        apiEndpoint: "127.0.0.1:8085",
      });
      functions.logger.info("Pub/Sub client initialized for EMULATOR");
    } else {
      // Production configuration
      pubsubClient = new PubSubClient();
      functions.logger.info("Pub/Sub client initialized for PRODUCTION");
    }
    
    return pubsubClient;
  } catch (error) {
    functions.logger.error("Failed to initialize Pub/Sub client", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Firestore trigger: Auto-process new queue items
 * Triggers when a new document is created in 'pubsubQueue'
 */
export const processPubSubQueue = functions.firestore
  .document("pubsubQueue/{queueId}")
  .onCreate(async (snapshot, context) => {
    const queueId = context.params.queueId;
    const queueItem = snapshot.data();
    
    if (!queueItem) {
      functions.logger.error("Queue item is empty", { queueId });
      return;
    }

    const { topic, data, published } = queueItem;

    // Skip if already published
    if (published) {
      functions.logger.info("Queue item already published, skipping", { queueId });
      return;
    }

    functions.logger.info("Processing new queue item", { 
      queueId, 
      topic, 
      jobId: data?.jobId 
    });

    try {
      // Initialize Pub/Sub client
      const pubsub = initializePubSub();

      // Ensure topic exists
      const topicRef = pubsub.topic(topic);
      const [exists] = await topicRef.exists();
      
      if (!exists) {
        functions.logger.info("Creating topic", { topic });
        await pubsub.createTopic(topic);
      }

      // Publish message
      const messageBuffer = Buffer.from(JSON.stringify(data));
      const messageId = await topicRef.publish(messageBuffer);

      functions.logger.info("Message published to Pub/Sub", {
        queueId,
        topic,
        messageId,
        jobId: data?.jobId,
      });

      // Update queue item as published
      await snapshot.ref.update({
        published: true,
        publishedAt: FieldValue.serverTimestamp(),
        messageId,
      });

      // Update corresponding job status if jobId exists
      if (data?.jobId) {
        const db = admin.firestore();
        await db.collection("jobs").doc(data.jobId).update({
          status: "dispatched",
          dispatchedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      functions.logger.error("Failed to publish message", {
        queueId,
        topic,
        error: errorMessage,
      });

      // Update queue item with error
      await snapshot.ref.update({
        error: errorMessage,
        lastAttemptAt: FieldValue.serverTimestamp(),
        retryCount: FieldValue.increment(1),
      });

      // If it's a critical job, update job status to failed
      if (data?.jobId) {
        const db = admin.firestore();
        await db.collection("jobs").doc(data.jobId).update({
          status: "failed",
          error: errorMessage,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      throw error; // Re-throw to trigger Cloud Functions retry mechanism
    }
  });

/**
 * Scheduled function: Retry failed queue items
 * Runs every 5 minutes to retry failed publications
 */
export const retryFailedQueueItems = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async (context) => {
    functions.logger.info("Starting retry job for failed queue items");

    const db = admin.firestore();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Find items that failed and haven't been retried recently
    const failedItems = await db
      .collection("pubsubQueue")
      .where("published", "==", false)
      .where("error", "!=", null)
      .where("lastAttemptAt", "<", fiveMinutesAgo)
      .limit(10) // Process 10 at a time
      .get();

    if (failedItems.empty) {
      functions.logger.info("No failed items to retry");
      return;
    }

    functions.logger.info(`Found ${failedItems.size} failed items to retry`);

    const pubsub = initializePubSub();
    let successCount = 0;
    let failCount = 0;

    for (const doc of failedItems.docs) {
      const queueItem = doc.data();
      const { topic, data, retryCount = 0 } = queueItem;

      // Max 3 retries
      if (retryCount >= 3) {
        functions.logger.warn("Max retries reached, marking as permanently failed", {
          queueId: doc.id,
          retryCount,
        });
        
        await doc.ref.update({
          permanentlyFailed: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        
        failCount++;
        continue;
      }

      try {
        const topicRef = pubsub.topic(topic);
        const messageBuffer = Buffer.from(JSON.stringify(data));
        const messageId = await topicRef.publish(messageBuffer);

        await doc.ref.update({
          published: true,
          publishedAt: FieldValue.serverTimestamp(),
          messageId,
          error: FieldValue.delete(),
        });

        functions.logger.info("Retry successful", { queueId: doc.id, messageId });
        successCount++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        await doc.ref.update({
          error: errorMessage,
          lastAttemptAt: FieldValue.serverTimestamp(),
          retryCount: FieldValue.increment(1),
        });

        functions.logger.error("Retry failed", { queueId: doc.id, error: errorMessage });
        failCount++;
      }
    }

    functions.logger.info("Retry job complete", { 
      total: failedItems.size,
      successful: successCount, 
      failed: failCount 
    });

    return { successCount, failCount };
  });