// functions-api/src/webhooks/setupWebhook.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Octokit } from "@octokit/rest";
import * as crypto from "crypto";

/**
 * HTTP endpoint to setup GitHub webhook for a repository
 * Called from frontend when connecting a new repository
 */
export const setupWebhook = functions.https.onRequest(async (req, res) => {
  // ✅ CRITICAL: Enable CORS for frontend requests
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { repoFullName } = req.body;

    if (!repoFullName) {
      res.status(400).json({ error: "repoFullName is required" });
      return;
    }

    functions.logger.info("Setting up webhook", { repoFullName });

    // Parse owner/repo
    const [owner, repo] = repoFullName.split("/");
    
    if (!owner || !repo) {
      res.status(400).json({ error: "Invalid repoFullName format. Expected: owner/repo" });
      return;
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    // Get GitHub credentials from environment
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_INSTALLATION_TOKEN;
    
    if (!githubToken) {
      functions.logger.warn("No GitHub token available, returning mock data");
      
      // Return mock data for development
      res.status(200).json({
        webhookId: `webhook_${Date.now()}`,
        webhookSecret,
        mock: true,
      });
      return;
    }

    // Create Octokit client
    const octokit = new Octokit({
      auth: githubToken,
    });

    // Get webhook URL (use ngrok URL in development, Cloud Functions URL in production)
    const webhookUrl = process.env.GITHUB_WEBHOOK_URL || 
      `https://us-central1-ai-docgen-44b16.cloudfunctions.net/githubWebhook`;

    try {
      // Create webhook on GitHub
      const webhook = await octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: webhookSecret,
          insecure_ssl: "0",
        },
        events: ["pull_request", "push"],
        active: true,
      });

      functions.logger.info("Webhook created successfully", {
        repoFullName,
        webhookId: webhook.data.id,
      });

      res.status(200).json({
        webhookId: webhook.data.id.toString(),
        webhookSecret,
        webhookUrl,
      });

    } catch (error: any) {
      // Handle webhook already exists
      if (error.status === 422) {
        functions.logger.warn("Webhook already exists", { repoFullName });
        
        // Try to get existing webhooks
        const webhooks = await octokit.repos.listWebhooks({ owner, repo });
        const existingWebhook = webhooks.data.find(w => w.config.url === webhookUrl);
        
        if (existingWebhook) {
          res.status(200).json({
            webhookId: existingWebhook.id.toString(),
            webhookSecret: "existing",
            note: "Webhook already exists",
          });
          return;
        }
      }

      throw error;
    }

  } catch (error: any) {
    functions.logger.error("Failed to setup webhook", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: "Failed to setup webhook",
      message: error.message,
    });
  }
});