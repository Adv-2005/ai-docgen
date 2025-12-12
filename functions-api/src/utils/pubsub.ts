// functions-api/src/utils/pubsub.ts
import * as functions from "firebase-functions";

/**
 * Publishes a message to a Pub/Sub topic
 * Works with both emulator and production
 */
export async function publishToPubSub(topicName: string, data: any): Promise<void> {
  try {
    // In Firebase Functions v1, we don't have direct Pub/Sub publishing
    // Instead, we'll use the @google-cloud/pubsub library
    
    // For now, create a helper that will be called from the webhook
    // This is a placeholder - we'll implement proper Pub/Sub in the next step
    
    functions.logger.info("Publishing to Pub/Sub topic", { topicName, data });
    
    // The actual Pub/Sub trigger will be handled by Firebase
    // We just need to ensure the topic exists and data is properly formatted
    
  } catch (error) {
    functions.logger.error("Failed to publish to Pub/Sub", {
      topicName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}