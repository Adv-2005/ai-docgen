// functions-api/src/types/index.ts

/**
 * Job document stored in Firestore 'jobs' collection
 */
export interface Job {
  jobId?: string; // Document ID
  jobType: "initial-ingestion" | "pr-analysis" | "push-analysis" | "delta-analysis";
  status: "queued" | "in-progress" | "completed" | "failed";
  repoFullName: string;
  repoId: string;
  
  // PR-specific fields
  prNumber?: number;
  prAction?: "opened" | "synchronize" | "closed";
  headSha?: string;
  headRef?: string;
  baseRef?: string;
  
  // Push-specific fields
  ref?: string;
  beforeSha?: string;
  afterSha?: string;
  changedFiles?: string[];
  commitCount?: number;
  
  // Timestamps
  createdAt: Date | FirebaseFirestore.Timestamp;
  updatedAt: Date | FirebaseFirestore.Timestamp;
  startedAt?: Date | FirebaseFirestore.Timestamp;
  completedAt?: Date | FirebaseFirestore.Timestamp;
  
  // Results
  resultId?: string;
  error?: string;
  
  // Metadata
  metadata?: {
    sender?: string;
    prState?: string;
    [key: string]: any;
  };
}

/**
 * Webhook event log
 */
export interface WebhookEvent {
  deliveryId: string;
  event: string;
  repoFullName: string;
  repoId: number;
  action?: string;
  receivedAt: Date | FirebaseFirestore.Timestamp;
  processed: boolean;
  jobId?: string;
}

/**
 * Job result document
 */
export interface JobResult {
  jobId: string | null;
  repoId: string;
  prNumber?: number | null;
  status: "completed" | "failed";
  note?: string;
  receivedAt: Date | FirebaseFirestore.Timestamp;
  resultAt: Date | FirebaseFirestore.Timestamp;
  
  // Analysis results (to be expanded in later milestones)
  analysis?: {
    filesAnalyzed?: number;
    linesOfCode?: number;
    docsGenerated?: number;
  };
}

/**
 * Repository configuration
 */
export interface Repository {
  repoId: string;
  repoFullName: string;
  ownerLogin: string;
  installationId?: number;
  accessToken?: string;
  webhookSecret?: string;
  lastAnalyzedSha?: string;
  lastAnalyzedAt?: Date | FirebaseFirestore.Timestamp;
  createdAt: Date | FirebaseFirestore.Timestamp;
  updatedAt: Date | FirebaseFirestore.Timestamp;
  isActive: boolean;
}