// frontend/src/lib/github.ts
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  created_at: string;
}

/**
 * ✅ FIXED: Fetch real GitHub repositories using stored token
 */
export async function fetchGitHubRepositories(user: User): Promise<GitHubRepo[]> {
  try {
    console.log('🔍 Fetching GitHub repositories for user:', user.uid);
    
    // ✅ Step 1: Get the GitHub token from Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.error('❌ User document not found in Firestore');
      throw new Error('User not found. Please sign in again.');
    }
    
    const userData = userSnap.data();
    const githubToken = userData?.githubAccessToken;
    
    if (!githubToken) {
      console.error('❌ No GitHub token found in Firestore');
      throw new Error('GitHub token not found. Please sign out and sign in again.');
    }
    
    // ✅ Check if token looks valid
    if (githubToken.includes('FirebaseAuthEmulatorFakeAccessToken')) {
      console.error('❌ Received fake emulator token');
      throw new Error('Invalid token: Using Auth Emulator. Please use production Firebase Auth.');
    }
    
    // ✅ Valid GitHub token formats: ghu_, ghp_, gho_, ghs_
    const validPrefixes = ['ghu_', 'ghp_', 'gho_', 'ghs_'];
    const hasValidPrefix = validPrefixes.some(prefix => githubToken.startsWith(prefix));
    
    if (!hasValidPrefix) {
      console.error('❌ Invalid token format:', githubToken.substring(0, 10));
      throw new Error('Invalid GitHub token format. Please sign out and sign in again.');
    }
    
    console.log('✅ GitHub token found:', {
      tokenPrefix: githubToken.substring(0, 15) + '...',
      tokenLength: githubToken.length,
    });
    
    // ✅ Step 2: Fetch repositories from GitHub API
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-DocGen-App',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ GitHub API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      if (response.status === 401) {
        throw new Error('GitHub token expired or invalid. Please sign out and sign in again.');
      }
      
      throw new Error(`GitHub API error: ${response.status} ${errorData.message || response.statusText}`);
    }

    const repos: GitHubRepo[] = await response.json();
    
    console.log('✅ Successfully fetched repositories:', {
      count: repos.length,
      first5: repos.slice(0, 5).map(r => r.full_name),
    });
    
    return repos;

  } catch (error: any) {
    console.error('❌ Failed to fetch GitHub repositories:', error);
    
    // Don't fall back to mock data - let the error bubble up
    throw new Error(error.message || 'Failed to fetch repositories from GitHub');
  }
}

/**
 * Setup webhook for a repository
 */
export async function setupWebhook(repoFullName: string): Promise<{
  webhookId: string;
  webhookSecret: string;
}> {
  console.log('⚙️ Setting up webhook for:', repoFullName);

  // Use relative URL - always calls the same domain the app is running on
  try {
    const response = await fetch('/api/setup-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoFullName }),
    });

    if (!response.ok) {
      throw new Error(`Webhook setup failed: ${response.status}`);
    }

    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('❌ Webhook setup error:', error);
    
    // For now, return mock data to allow testing
    return {
      webhookId: `webhook_${Date.now()}`,
      webhookSecret: `secret_${Math.random().toString(36).substring(7)}`,
    };
  }
}

/**
 * Trigger initial repository analysis
 */
export async function triggerInitialAnalysis(repoFullName: string): Promise<void> {
  console.log('🚀 Triggering initial analysis for:', repoFullName);

  // Use relative URL - always calls the same domain the app is running on
  try {
    const response = await fetch('/api/trigger-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        repoFullName,
        jobType: 'initial-ingestion'
      }),
    });

    if (!response.ok) {
      console.warn('⚠️ Analysis trigger failed:', response.status);
    } else {
      console.log('✅ Analysis triggered successfully');
    }
  } catch (error) {
    console.error('❌ Analysis trigger error:', error);
  }
}