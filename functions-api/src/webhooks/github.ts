// functions-api/src/webhooks/github.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createHmac, timingSafeEqual } from "crypto";

interface GitHubWebhookPayload {
  action?: string;
  pull_request?: {
    number: number;
    state: string;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      ref: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
  ref?: string;
  before?: string;
  after?: string;
  commits?: Array<{
    id: string;
    message: string;
    modified: string[];
    added: string[];
    removed: string[];
  }>;
}

/**
 * Verifies the GitHub webhook signature
 */
function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature) return false;
  
  const hmac = createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  
  // Ensure both buffers have the same length for timingSafeEqual
  if (signature.length !== digest.length) {
    return false;
  }
  
  try {
    return timingSafeEqual(
      Buffer.from(signature, "utf8") as NodeJS.ArrayBufferView,
      Buffer.from(digest, "utf8") as NodeJS.ArrayBufferView
    );
  } catch (error) {
    return false;
  }
}

/**
 * Main GitHub webhook handler
 */
export const githubWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const event = req.headers["x-github-event"] as string;
  const signature = req.headers["x-hub-signature-256"] as string;
  const deliveryId = req.headers["x-github-delivery"] as string;

  functions.logger.info("GitHub webhook received", {
    event,
    deliveryId,
    repoName: req.body?.repository?.full_name,
  });

  // Verify webhook signature (use environment variable for secret)
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "dev-secret";
  const rawBody = JSON.stringify(req.body);
  
  if (!verifyGitHubSignature(rawBody, signature, webhookSecret)) {
    functions.logger.warn("Invalid webhook signature", { deliveryId });
    res.status(401).send("Unauthorized");
    return;
  }

  const payload: GitHubWebhookPayload = req.body;
  const db = admin.firestore();
  const pubsub = admin.messaging(); // We'll use Pub/Sub via messaging or direct SDK

  try {
    // Log webhook event to Firestore
    const webhookEventData: any = {
      deliveryId,
      event,
      repoFullName: payload.repository.full_name,
      repoId: payload.repository.id,
      receivedAt: new Date(),
      processed: false,
    };
    
    // Only add action if it exists (PR events have action, push events don't)
    if (payload.action) {
      webhookEventData.action = payload.action;
    }
    
    await db.collection("webhookEvents").add(webhookEventData);

    // Route based on event type
    let jobCreated = false;

    switch (event) {
      case "pull_request":
        jobCreated = await handlePullRequestEvent(payload, event);
        break;

      case "push":
        jobCreated = await handlePushEvent(payload);
        break;

      default:
        functions.logger.info(`Ignoring event type: ${event}`);
    }

    if (jobCreated) {
      res.status(200).json({ 
        success: true, 
        message: "Webhook processed and job created",
        deliveryId 
      });
    } else {
      res.status(200).json({ 
        success: true, 
        message: "Webhook received but no job created",
        deliveryId 
      });
    }

  } catch (error) {
    functions.logger.error("Webhook processing error", {
      error: error instanceof Error ? error.message : String(error),
      deliveryId,
    });
    
    res.status(500).json({ 
      success: false, 
      error: "Internal processing error" 
    });
  }
});

/**
 * Handle Pull Request events
 */
async function handlePullRequestEvent(
  payload: GitHubWebhookPayload,
  event: string
): Promise<boolean> {
  const action = payload.action;
  const pr = payload.pull_request;
  
  if (!pr) return false;

  // Only process opened, synchronize (updated), or closed events
  const relevantActions = ["opened", "synchronize", "closed"];
  if (!action || !relevantActions.includes(action)) {
    functions.logger.info(`Ignoring PR action: ${action}`);
    return false;
  }

  const db = admin.firestore();

  // Create job document
  const jobData = {
    jobType: "pr-analysis",
    status: "queued",
    repoFullName: payload.repository.full_name,
    repoId: payload.repository.id.toString(),
    prNumber: pr.number,
    prAction: action,
    headSha: pr.head.sha,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      sender: payload.sender.login,
      prState: pr.state,
    },
  };

  const jobRef = await db.collection("jobs").add(jobData);
  
  functions.logger.info("PR job created", {
    jobId: jobRef.id,
    prNumber: pr.number,
    action,
  });

  // Publish to Pub/Sub topic for worker processing
  await publishJobToPubSub("analyze-repo", {
    jobId: jobRef.id,
    jobType: "pr-analysis",
    repoId: payload.repository.id.toString(),
    prNumber: pr.number,
  });

  return true;
}

/**
 * Handle Push events
 */
async function handlePushEvent(payload: GitHubWebhookPayload): Promise<boolean> {
  const ref = payload.ref;
  
  // Only process pushes to main/master branch
  if (!ref || (!ref.endsWith("/main") && !ref.endsWith("/master"))) {
    functions.logger.info(`Ignoring push to ref: ${ref}`);
    return false;
  }

  const db = admin.firestore();

  // Extract changed files from commits
  const changedFiles = new Set<string>();
  payload.commits?.forEach((commit) => {
    commit.modified?.forEach((file) => changedFiles.add(file));
    commit.added?.forEach((file) => changedFiles.add(file));
  });

  const jobData = {
    jobType: "push-analysis",
    status: "queued",
    repoFullName: payload.repository.full_name,
    repoId: payload.repository.id.toString(),
    ref,
    beforeSha: payload.before,
    afterSha: payload.after,
    changedFiles: Array.from(changedFiles),
    commitCount: payload.commits?.length || 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      sender: payload.sender.login,
    },
  };

  const jobRef = await db.collection("jobs").add(jobData);
  
  functions.logger.info("Push job created", {
    jobId: jobRef.id,
    ref,
    commitCount: jobData.commitCount,
  });

  // Publish to Pub/Sub
  await publishJobToPubSub("analyze-repo", {
    jobId: jobRef.id,
    jobType: "push-analysis",
    repoId: payload.repository.id.toString(),
    changedFiles: jobData.changedFiles,
  });

  return true;
}

/**
 * Publish job message to Pub/Sub topic
 * For emulator: writes to Firestore queue (to be processed by a separate trigger)
 * For production: would use @google-cloud/pubsub SDK
 */
async function publishJobToPubSub(topicName: string, data: any): Promise<void> {
  const db = admin.firestore();
  
  // Store in Firestore queue for now
  // In production, this would directly publish to Pub/Sub
  await db.collection("pubsubQueue").add({
    topic: topicName,
    data,
    published: false,
    createdAt: new Date(),
  });
  
  functions.logger.info("Job published to queue", { topicName, data });
  
  // TODO: In production, replace with:
  // const { PubSub } = require('@google-cloud/pubsub');
  // const pubsub = new PubSub();
  // await pubsub.topic(topicName).publishMessage({ json: data });
}