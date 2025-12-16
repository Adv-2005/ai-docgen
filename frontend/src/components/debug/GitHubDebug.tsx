// frontend/src/components/debug/GitHubDebug.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

export default function GitHubDebug() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'real' | 'fake' | 'none'>('none');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkToken();
    }
  }, [user]);

  const checkToken = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Get token from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        setError('User document not found in Firestore');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const githubToken = userData?.githubAccessToken;

      if (!githubToken) {
        setError('No GitHub token found in Firestore');
        setTokenType('none');
        setLoading(false);
        return;
      }

      setToken(githubToken);

      // Determine token type
      if (githubToken.includes('FirebaseAuthEmulatorFakeAccessToken')) {
        setTokenType('fake');
        setError('Using FAKE emulator token - will not work with GitHub API');
      } else if (githubToken.startsWith('ghu_') || githubToken.startsWith('ghp_')) {
        setTokenType('real');
        // Test the token
        await testToken(githubToken);
      } else {
        setTokenType('none');
        setError('Unknown token format');
      }
    } catch (err: any) {
      console.error('Token check error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testToken = async (githubToken: string) => {
    try {
      // Test 1: Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(`GitHub API Error (${userResponse.status}): ${errorData.message}`);
      }

      const userData = await userResponse.json();
      setUserInfo(userData);

      // Test 2: Get repositories
      const reposResponse = await fetch('https://api.github.com/user/repos?per_page=5&sort=updated', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!reposResponse.ok) {
        throw new Error(`Failed to fetch repos (${reposResponse.status})`);
      }

      const reposData = await reposResponse.json();
      setRepos(reposData);
      
      console.log('✅ GitHub API test successful:', {
        user: userData.login,
        repos: reposData.length,
      });
    } catch (err: any) {
      console.error('GitHub API test failed:', err);
      setError(err.message);
      setTokenType('none');
    }
  };

  if (!user) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Not authenticated. Please sign in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          GitHub Token Debug Panel
        </h3>
        <button
          onClick={checkToken}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" />
              Recheck
            </>
          )}
        </button>
      </div>

      {/* Token Status */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start gap-3">
          {tokenType === 'real' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : tokenType === 'fake' ? (
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              Token Status: {tokenType === 'real' ? 'Valid ✅' : tokenType === 'fake' ? 'Fake Emulator Token ⚠️' : 'Missing/Invalid ❌'}
            </p>
            
            {token && (
              <p className="text-xs text-gray-600 mt-1 font-mono break-all">
                {token.substring(0, 20)}...{token.substring(token.length - 10)}
              </p>
            )}
            
            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* User Info */}
      {userInfo && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-medium text-green-900 mb-2">✅ GitHub API Connection Working</p>
          <div className="space-y-1 text-sm text-green-800">
            <p><strong>GitHub User:</strong> {userInfo.login}</p>
            <p><strong>Name:</strong> {userInfo.name || 'N/A'}</p>
            <p><strong>Public Repos:</strong> {userInfo.public_repos}</p>
            <p><strong>Private Repos:</strong> {userInfo.total_private_repos || 0}</p>
          </div>
        </div>
      )}

      {/* Sample Repos */}
      {repos.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-medium text-blue-900 mb-2">
            Sample Repositories ({repos.length})
          </p>
          <div className="space-y-2">
            {repos.map((repo) => (
              <div key={repo.id} className="text-sm text-blue-800">
                • {repo.full_name} {repo.private ? '🔒' : '🌍'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {tokenType === 'fake' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="font-medium text-yellow-900 mb-2">⚠️ Fix Required</p>
          <div className="text-sm text-yellow-800 space-y-2">
            <p>You're using the Auth Emulator which provides fake tokens.</p>
            <p className="font-medium">To fix:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Remove <code className="bg-yellow-100 px-1 rounded">connectAuthEmulator</code> from firebase.ts</li>
              <li>Clear browser storage: <code className="bg-yellow-100 px-1 rounded">localStorage.clear()</code></li>
              <li>Sign out and sign in again</li>
              <li>You should get a token starting with <code className="bg-yellow-100 px-1 rounded">ghu_</code></li>
            </ol>
          </div>
        </div>
      )}

      {tokenType === 'none' && !loading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-medium text-red-900 mb-2">❌ No Valid Token</p>
          <div className="text-sm text-red-800 space-y-2">
            <p>Try these steps:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Sign out completely</li>
              <li>Clear browser cache and localStorage</li>
              <li>Sign in again with GitHub</li>
              <li>Check this panel again</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}