// frontend/src/components/test/TestGitHubConnection.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGitHubRepositories, GitHubRepo } from '@/lib/github';
import { Loader2, Github, CheckCircle, XCircle } from 'lucide-react';

export default function TestGitHubConnection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleTestConnection = async () => {
    if (!user) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setRepos([]);

    try {
      console.log('🚀 Testing GitHub connection...');
      const repositories = await fetchGitHubRepositories(user);
      
      setRepos(repositories);
      console.log('✅ Successfully fetched repositories:', repositories.length);
      
      if (repositories.length > 0) {
        setError(null);
      }
    } catch (err: any) {
      console.error('❌ Test failed:', err);
      setError(err.message || 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Github className="w-5 h-5" />
        Test GitHub API Connection
      </h3>

      <button
        onClick={handleTestConnection}
        disabled={loading || !user}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Github className="w-4 h-4" />
            Test Connection
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Connection Failed</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {repos.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <p className="font-medium">Successfully connected! Found {repos.length} repositories</p>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{repo.name}</p>
                    <p className="text-sm text-gray-500">{repo.full_name}</p>
                  </div>
                  {repo.private && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                      Private
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-sm text-gray-600 mt-1">{repo.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  {repo.language && <span>🔵 {repo.language}</span>}
                  <span>⭐ {repo.stargazers_count}</span>
                  <span>🍴 {repo.forks_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}