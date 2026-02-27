// frontend/src/app/api/github-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
if (getApps().length === 0) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) {
    console.warn('Firebase Admin SDK not configured - using client SDK only');
  } else {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const db = getFirestore();

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
  
  const hmac = createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  // Ensure both buffers have the same length for timingSafeEqual
  if (signature.length !== digest.length) {
    return false;
  }
  
  try {
    return timingSafeEqual(
      Buffer.from(signature, 'utf8') as NodeJS.ArrayBufferView,
      Buffer.from(digest, 'utf8') as NodeJS.ArrayBufferView
    );
  } catch (error) {
    return false;
  }
}

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
  const relevantActions = ['opened', 'synchronize', 'closed'];
  if (!action || !relevantActions.includes(action)) {
    console.log(`Ignoring PR action: ${action}`);
    return false;
  }

  // Create job document
  const jobData = {
    jobType: 'pr-analysis',
    status: 'queued',
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

  const jobRef = await db.collection('jobs').add(jobData);
  
  console.log('PR job created', {
    jobId: jobRef.id,
    prNumber: pr.number,
    action,
  });

  // Publish to queue for worker processing
  await publishJobToQueue('analyze-repo', {
    jobId: jobRef.id,
    jobType: 'pr-analysis',
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
  if (!ref || (!ref.endsWith('/main') && !ref.endsWith('/master'))) {
    console.log(`Ignoring push to ref: ${ref}`);
    return false;
  }

  // Extract changed files from commits
  const changedFiles = new Set<string>();
  payload.commits?.forEach((commit) => {
    commit.modified?.forEach((file) => changedFiles.add(file));
    commit.added?.forEach((file) => changedFiles.add(file));
  });

  const jobData = {
    jobType: 'push-analysis',
    status: 'queued',
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

  const jobRef = await db.collection('jobs').add(jobData);
  
  console.log('Push job created', {
    jobId: jobRef.id,
    ref,
    commitCount: jobData.commitCount,
  });

  // Publish to queue
  await publishJobToQueue('analyze-repo', {
    jobId: jobRef.id,
    jobType: 'push-analysis',
    repoId: payload.repository.id.toString(),
    changedFiles: jobData.changedFiles,
  });

  return true;
}

/**
 * Publish job message to queue
 * Stores in Firestore queue for worker processing
 */
async function publishJobToQueue(topicName: string, data: any): Promise<void> {
  // Store in Firestore queue for worker processing
  await db.collection('pubsubQueue').add({
    topic: topicName,
    data,
    published: false,
    createdAt: new Date(),
  });
  
  console.log('Job published to queue', { topicName, data });
}

export async function POST(request: NextRequest) {
  try {
    const event = request.headers.get('x-github-event');
    const signature = request.headers.get('x-hub-signature-256');
    const deliveryId = request.headers.get('x-github-delivery');

    if (!event) {
      return NextResponse.json({ error: 'Missing x-github-event header' }, { status: 400 });
    }

    const body = await request.text();
    const payload: GitHubWebhookPayload = JSON.parse(body);

    console.log('GitHub webhook received', {
      event,
      deliveryId,
      repoName: payload?.repository?.full_name,
    });

    // Verify webhook signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || 'dev-secret';
    
    if (signature && !verifyGitHubSignature(body, signature, webhookSecret)) {
      console.warn('Invalid webhook signature', { deliveryId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Log webhook event to Firestore using Admin SDK
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
    
    await db.collection('webhookEvents').add(webhookEventData);

    // Route based on event type
    let jobCreated = false;

    switch (event) {
      case 'pull_request':
        jobCreated = await handlePullRequestEvent(payload, event);
        break;

      case 'push':
        jobCreated = await handlePushEvent(payload);
        break;

      default:
        console.log(`Ignoring event type: ${event}`);
    }

    if (jobCreated) {
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook processed and job created',
        deliveryId 
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook received but no job created',
        deliveryId 
      });
    }

  } catch (error) {
    console.error('Webhook processing error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json({ 
      success: false, 
      error: 'Internal processing error' 
    }, { status: 500 });
  }
}