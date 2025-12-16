// frontend/src/lib/github.ts
import { User } from 'firebase/auth';

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
 * Fetch user's GitHub repositories
 * In development, returns mock data
 */
export async function fetchGitHubRepositories(user: User): Promise<GitHubRepo[]> {
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    console.log('🔧 Development mode: Using mock GitHub repositories');
    return getMockRepositories();
  }

  try {
    // Get GitHub access token from user's Firebase auth
    // This requires GitHub OAuth to be properly configured
    const token = await getGitHubAccessToken(user);
    
    if (!token) {
      console.warn('No GitHub access token found, using mock data');
      return getMockRepositories();
    }

    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const repos: GitHubRepo[] = await response.json();
    return repos;

  } catch (error) {
    console.error('Failed to fetch GitHub repositories:', error);
    console.warn('Falling back to mock data');
    return getMockRepositories();
  }
}

/**
 * Get GitHub access token from Firebase user
 */
async function getGitHubAccessToken(user: User): Promise<string | null> {
  try {
    // Get the ID token result which contains OAuth tokens
    const idTokenResult = await user.getIdTokenResult();
    
    // The GitHub access token is stored in custom claims or provider data
    // Try to get it from the ID token
    if (idTokenResult.claims.github_access_token) {
      return idTokenResult.claims.github_access_token as string;
    }

    // Alternative: Try to get fresh token using getIdToken with force refresh
    // This triggers Firebase to fetch a new token
    await user.getIdToken(true);
    
    // Check provider data
    const providerData = user.providerData.find(p => p.providerId === 'github.com');
    
    if (providerData) {
      // The token might be in Firebase's internal storage
      // We need to call a backend endpoint to retrieve it
      const token = await fetchGitHubTokenFromBackend(user);
      return token;
    }
    
    console.warn('No GitHub access token found');
    return null;
  } catch (error) {
    console.error('Failed to get GitHub access token:', error);
    return null;
  }
}

/**
 * Fetch GitHub token from backend
 * This is necessary because Firebase doesn't expose OAuth tokens directly to the client
 */
async function fetchGitHubTokenFromBackend(user: User): Promise<string | null> {
  try {
    const idToken = await user.getIdToken();
    
    // Call your Firebase Function to get the GitHub token
    const response = await fetch(`${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || ''}/getGitHubToken`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch GitHub token from backend');
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('Error fetching GitHub token from backend:', error);
    return null;
  }
}

/**
 * Setup webhook for a repository
 * This should call your Firebase Function
 */
export async function setupWebhook(repoFullName: string): Promise<{
  webhookId: string;
  webhookSecret: string;
}> {
  console.log('Setting up webhook for:', repoFullName);

  // In development, simulate the webhook setup
  if (process.env.NODE_ENV === 'development') {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      webhookId: `webhook_${Date.now()}`,
      webhookSecret: `secret_${Math.random().toString(36).substring(7)}`,
    };
  }

  try {
    // Call your Firebase Function to setup the webhook
    const response = await fetch('/api/webhooks/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoFullName }),
    });

    if (!response.ok) {
      throw new Error('Failed to setup webhook');
    }

    return await response.json();
  } catch (error) {
    console.error('Webhook setup error:', error);
    throw error;
  }
}

/**
 * Trigger initial repository analysis
 */
export async function triggerInitialAnalysis(repoFullName: string): Promise<void> {
  console.log('Triggering initial analysis for:', repoFullName);

  // In development, simulate the trigger
  if (process.env.NODE_ENV === 'development') {
    await new Promise(resolve => setTimeout(resolve, 300));
    return;
  }

  try {
    const response = await fetch('/api/analysis/trigger', {
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
      throw new Error('Failed to trigger analysis');
    }
  } catch (error) {
    console.error('Analysis trigger error:', error);
    throw error;
  }
}

/**
 * Get mock repositories for development/testing
 */
function getMockRepositories(): GitHubRepo[] {
  return [
    {
      id: 1,
      name: 'ai-docgen',
      full_name: 'user/ai-docgen',
      description: 'AI-powered documentation generator for codebases',
      private: false,
      owner: {
        login: 'user',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      html_url: 'https://github.com/user/ai-docgen',
      language: 'TypeScript',
      stargazers_count: 42,
      forks_count: 8,
      default_branch: 'main',
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 2,
      name: 'react-dashboard',
      full_name: 'user/react-dashboard',
      description: 'Modern React dashboard with real-time analytics',
      private: false,
      owner: {
        login: 'user',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      html_url: 'https://github.com/user/react-dashboard',
      language: 'JavaScript',
      stargazers_count: 156,
      forks_count: 23,
      default_branch: 'main',
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 3,
      name: 'api-gateway',
      full_name: 'user/api-gateway',
      description: 'Microservices API gateway with authentication',
      private: true,
      owner: {
        login: 'user',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      html_url: 'https://github.com/user/api-gateway',
      language: 'Go',
      stargazers_count: 89,
      forks_count: 12,
      default_branch: 'main',
      updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 4,
      name: 'mobile-app',
      full_name: 'user/mobile-app',
      description: 'Cross-platform mobile application built with React Native',
      private: false,
      owner: {
        login: 'user',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      html_url: 'https://github.com/user/mobile-app',
      language: 'TypeScript',
      stargazers_count: 234,
      forks_count: 45,
      default_branch: 'main',
      updated_at: new Date(Date.now() - 0.5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 5,
      name: 'data-pipeline',
      full_name: 'user/data-pipeline',
      description: 'ETL pipeline for processing large datasets',
      private: true,
      owner: {
        login: 'user',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      html_url: 'https://github.com/user/data-pipeline',
      language: 'Python',
      stargazers_count: 67,
      forks_count: 15,
      default_branch: 'main',
      updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 6,
      name: 'design-system',
      full_name: 'user/design-system',
      description: 'Reusable component library with Storybook',
      private: false,
      owner: {
        login: 'user',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      html_url: 'https://github.com/user/design-system',
      language: 'TypeScript',
      stargazers_count: 312,
      forks_count: 56,
      default_branch: 'main',
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}