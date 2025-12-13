// functions-worker/src/utils/github-auth.ts
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import * as functions from "firebase-functions";
import * as fs from "fs";
import * as path from "path";

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: string;
}

/**
 * Get GitHub App configuration from environment
 */
function getGitHubAppConfig(): GitHubAppConfig {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;

  if (!appId || !installationId) {
    throw new Error("GitHub App configuration missing. Set GITHUB_APP_ID and GITHUB_APP_INSTALLATION_ID");
  }

  // Read private key from file or environment variable
  let privateKey: string;

  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    // Private key provided directly in env (for production)
    privateKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
  } else if (privateKeyPath) {
    // Private key path provided (for local development)
    const fullPath = path.resolve(privateKeyPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Private key file not found: ${fullPath}`);
    }
    
    privateKey = fs.readFileSync(fullPath, "utf-8");
  } else {
    throw new Error("GitHub App private key not configured. Set GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_PATH");
  }

  return {
    appId,
    privateKey,
    installationId,
  };
}

/**
 * Create authenticated Octokit instance using GitHub App
 */
export function getGitHubAppClient(): Octokit {
  const config = getGitHubAppConfig();

  functions.logger.info("Initializing GitHub App client", {
    appId: config.appId,
    installationId: config.installationId,
  });

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
      installationId: config.installationId,
    },
  });

  return octokit;
}

/**
 * Get Octokit client based on configuration
 * Falls back to personal token if GitHub App is not configured
 */
export function getGitHubClient(): Octokit {
  // Try GitHub App first
  if (process.env.GITHUB_APP_ID && process.env.GITHUB_APP_INSTALLATION_ID) {
    try {
      return getGitHubAppClient();
    } catch (error) {
      functions.logger.warn("Failed to initialize GitHub App client, falling back to token", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fall back to personal access token
  if (process.env.GITHUB_TOKEN) {
    functions.logger.info("Using GitHub personal access token");
    return new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  // No authentication configured
  functions.logger.warn("No GitHub authentication configured, using unauthenticated client");
  return new Octokit();
}

/**
 * Check if GitHub App is configured
 */
export function isGitHubAppConfigured(): boolean {
  return !!(
    process.env.GITHUB_APP_ID &&
    process.env.GITHUB_APP_INSTALLATION_ID &&
    (process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_APP_PRIVATE_KEY_PATH)
  );
}

/**
 * Check if personal token is configured
 */
export function isPersonalTokenConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Get authentication method being used
 */
export function getAuthMethod(): "github-app" | "personal-token" | "none" {
  if (isGitHubAppConfigured()) {
    return "github-app";
  } else if (isPersonalTokenConfigured()) {
    return "personal-token";
  }
  return "none";
}