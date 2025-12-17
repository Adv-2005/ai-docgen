// frontend/src/components/debug/GitHubDebug.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw, Copy, ExternalLink } from 'lucide-react';

export default function GitHubDebug() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'real' | 'fake' | 'none'>('none');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any>({});

  useEffect(() => {
    if (user) {
      checkToken();
    }
  }, [user]);

  const checkToken = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    const results: any = {};

    try {
      // Test 1: Check Firestore
      results.firestoreCheck = { status: 'running' };
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        results.firestoreCheck = { status: 'error', message: 'User document not found' };
        setError('User document not found in Firestore');
        setTokenType('none');
        setTestResults(results);
        setLoading(false);
        return;
      }

      results.firestoreCheck = { status: 'success', message: 'User document found' };

      const userData = userDoc.data();
      const githubToken = userData?.githubAccessToken;

      if (!githubToken) {
        results.tokenCheck = { status: 'error', message: 'No token in Firestore' };
        setError('No GitHub token found in Firestore');
        setTokenType('none');
        setTestResults(results);
        setLoading(false);
        return;
      }

      setToken(githubToken);

      // Test 2: Check token format
      if (githubToken.includes('FirebaseAuthEmulatorFakeAccessToken')) {
        results.tokenCheck = { status: 'error', message: 'Fake emulator token detected' };
        setTokenType('fake');
        setError('Using FAKE emulator token - Remove connectAuthEmulator() from firebase.ts');
      } else if (githubToken.startsWith('ghu_') || githubToken.startsWith('ghp_') || githubToken.startsWith('gho_')) {
        results.tokenCheck = { status: 'success', message: `Valid token format (${githubToken.substring(0, 4)}...)` };
        setTokenType('real');
        
        // Test 3: Test GitHub API
        await testGitHubAPI(githubToken, results);
      } else {
        results.tokenCheck = { status: 'error', message: 'Unknown token format' };
        setTokenType('none');
        setError('Unknown token format');
      }
    } catch (err: any) {
      console.error('Token check error:', err);
      setError(err.message);
      results.error = err.message;
    } finally {
      setTestResults(results);
      setLoading(false);
    }
  };

  const testGitHubAPI = async (githubToken: string, results: any) => {
    try {
      // Test user endpoint
      results.userApiCheck = { status: 'running' };
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        results.userApiCheck = { 
          status: 'error', 
          message: `${userResponse.status}: ${errorData.message}` 
        };
        throw new Error(`GitHub API Error (${userResponse.status}): ${errorData.message}`);
      }

      const userData = await userResponse.json();
      setUserInfo(userData);
      results.userApiCheck = { status: 'success', message: `Connected as ${userData.login}` };

      // Test repos endpoint
      results.reposApiCheck = { status: 'running' };
      const reposResponse = await fetch('https://api.github.com/user/repos?per_page=5&sort=updated', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!reposResponse.ok) {
        results.reposApiCheck = { 
          status: 'error', 
          message: `Failed to fetch repos (${reposResponse.status})` 
        };
        throw new Error(`Failed to fetch repos (${reposResponse.status})`);
      }

      const reposData = await reposResponse.json();
      setRepos(reposData);
      results.reposApiCheck = { status: 'success', message: `Fetched ${reposData.length} repos` };
      
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

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
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
          GitHub Authentication Debug Panel
        </h3>
        <button
          onClick={checkToken}
          disabled={loading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <RefreshCw className="w-3 h-3" />
              Run Tests
            </>
          )}
        </button>
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="space-y-2">
          {Object.entries(testResults).map(([key, result]: [string, any]) => (
            <div
              key={key}
              className={`p-3 rounded-lg border-2 ${
                result.status === 'success'
                  ? 'border-green-200 bg-green-50'
                  : result.status === 'error'
                  ? 'border-red-200 bg-red-50'
                  : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {result.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                {result.status === 'error' && <XCircle className="w-4 h-4 text-red-600" />}
                {result.status === 'running' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                <span className="font-medium text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              </div>
              {result.message && (
                <p className="text-sm mt-1 ml-6">{result.message}</p>
              )}
            </div>
          ))}
        </div>
      )}

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
              <div className="flex items-center gap-2 mt-2">
                <code className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded border">
                  {token.substring(0, 20)}...{token.substring(token.length - 10)}
                </code>
                <button
                  onClick={copyToken}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Copy token"
                >
                  <Copy className="w-3 h-3 text-gray-600" />
                </button>
              </div>
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
            <div className="flex items-center gap-2">
              <span className="font-semibold">GitHub User:</span>
              <span>{userInfo.login}</span>
              <a
                href={userInfo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p><span className="font-semibold">Name:</span> {userInfo.name || 'N/A'}</p>
            <p><span className="font-semibold">Public Repos:</span> {userInfo.public_repos}</p>
            <p><span className="font-semibold">Private Repos:</span> {userInfo.total_private_repos || 0}</p>
            <p><span className="font-semibold">Account Created:</span> {new Date(userInfo.created_at).toLocaleDateString()}</p>
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
              <div key={repo.id} className="text-sm text-blue-800 flex items-center justify-between">
                <span>• {repo.full_name} {repo.private ? '🔒' : '🌍'}</span>
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fix Instructions */}
      {tokenType === 'fake' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="font-medium text-yellow-900 mb-2">⚠️ Fix Required</p>
          <div className="text-sm text-yellow-800 space-y-2">
            <p>You're using the Auth Emulator which provides fake tokens.</p>
            <p className="font-medium">To fix:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Open <code className="bg-yellow-100 px-1 rounded">frontend/src/lib/firebase.ts</code></li>
              <li>Remove or comment out <code className="bg-yellow-100 px-1 rounded">connectAuthEmulator(auth, ...)</code></li>
              <li>Clear browser storage: <code className="bg-yellow-100 px-1 rounded">localStorage.clear()</code></li>
              <li>Sign out and sign in again</li>
              <li>Token should start with <code className="bg-yellow-100 px-1 rounded">ghu_</code></li>
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
              <li>Verify <code className="bg-red-100 px-1 rounded">.env.local</code> has correct Firebase config</li>
              <li>Ensure GitHub OAuth is enabled in Firebase Console</li>
              <li>Sign in again with GitHub</li>
              <li>Check this panel again</li>
            </ol>
          </div>
        </div>
      )}

      {/* Firebase Config Check */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="font-medium text-gray-900 mb-2">🔧 Configuration</p>
        <div className="space-y-1 text-xs text-gray-600 font-mono">
          <p>User ID: {user.uid}</p>
          <p>Email: {user.email}</p>
          <p>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}</p>
          <p>Use Emulator: {process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR}</p>
        </div>
      </div>
    </div>
  );
}