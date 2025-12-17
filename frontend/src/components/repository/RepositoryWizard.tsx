// frontend/src/components/repository/RepositoryWizard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Loader2,
  Github,
  AlertCircle,
  ArrowRight,
  Search,
  CheckCircle,
  Sparkles,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGitHubRepositories, setupWebhook, triggerInitialAnalysis, GitHubRepo } from '@/lib/github';
import { addRepository } from '@/lib/firestore';
import RepoCard from './RepoCard';
import StepIndicator from './StepIndicator';
import ConnectionProgress from './ConnectionProgress';

interface RepositoryWizardProps {
  onClose: () => void;
  onComplete?: () => void;
}

export default function RepositoryWizard({ onClose, onComplete }: RepositoryWizardProps) {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectedRepos, setConnectedRepos] = useState<Set<number>>(new Set());
  const [failedRepos, setFailedRepos] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 1 && repositories.length === 0 && user) {
      loadRepositories();
    }
  }, [step, user]);

  const loadRepositories = async () => {
    if (!user) {
      setError('Not authenticated. Please sign in.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Loading GitHub repositories for user:', user.email);
      
      const repos = await fetchGitHubRepositories(user);
      
      console.log('✅ Loaded repositories:', repos.length);
      
      if (repos.length === 0) {
        setError('No repositories found in your GitHub account.');
      } else {
        setRepositories(repos);
      }
    } catch (err: any) {
      console.error('❌ Failed to load repositories:', err);
      
      // ✅ Better error messages
      let errorMessage = 'Failed to load repositories from GitHub.';
      
      if (err.message.includes('token expired') || err.message.includes('token expired')) {
        errorMessage = 'Your GitHub token has expired. Please sign out and sign in again.';
      } else if (err.message.includes('not found')) {
        errorMessage = 'GitHub account not properly connected. Please sign out and sign in again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  const toggleRepo = (repoId: number) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      newSelected.add(repoId);
    }
    setSelectedRepos(newSelected);
  };

  const handleConnect = async () => {
    if (!user) return;

    setConnecting(true);
    setStep(2);
    setError(null);

    const failed = new Set<number>();

    try {
      console.log(`🚀 Connecting ${selectedRepos.size} repositories...`);
      
      for (const repoId of selectedRepos) {
        const repo = repositories.find((r) => r.id === repoId);
        if (!repo) continue;

        try {
          console.log(`📦 Processing: ${repo.full_name}`);
          
          // Setup webhook
          const { webhookId, webhookSecret } = await setupWebhook(repo.full_name);

          // Add to Firestore
          await addRepository(user.uid, {
            repoId: repo.id.toString(),
            repoFullName: repo.full_name,
            ownerLogin: repo.owner.login,
            name: repo.name,
            description: repo.description || undefined,
            isPrivate: repo.private,
            language: repo.language || undefined,
            defaultBranch: repo.default_branch,
            webhookId,
            webhookSecret,
          });

          // Trigger initial analysis
          await triggerInitialAnalysis(repo.full_name);

          // Mark as connected
          setConnectedRepos((prev) => new Set([...prev, repoId]));
          
          console.log(`✅ Connected: ${repo.full_name}`);

          // Small delay between repos
          await new Promise((resolve) => setTimeout(resolve, 800));
        } catch (repoError) {
          console.error(`❌ Failed to connect ${repo.name}:`, repoError);
          failed.add(repoId);
        }
      }

      setFailedRepos(failed);
      setConnecting(false);
      
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStep(3);

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('❌ Failed to connect repositories:', err);
      setError('Failed to connect repositories. Please try again.');
      setConnecting(false);
    }
  };

  const filteredRepos = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Github className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Connect Repositories</h2>
              <p className="text-sm text-gray-500">Step {step} of 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={connecting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <StepIndicator number={1} label="Select Repos" active={step === 1} completed={step > 1} />
            <div className="flex-1 h-0.5 bg-gray-300 mx-4">
              <div
                className={`h-full bg-blue-600 transition-all duration-500 ${
                  step > 1 ? 'w-full' : 'w-0'
                }`}
              />
            </div>
            <StepIndicator number={2} label="Connect" active={step === 2} completed={step > 2} />
            <div className="flex-1 h-0.5 bg-gray-300 mx-4">
              <div
                className={`h-full bg-blue-600 transition-all duration-500 ${
                  step > 2 ? 'w-full' : 'w-0'
                }`}
              />
            </div>
            <StepIndicator number={3} label="Complete" active={step === 3} completed={false} />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <div className="flex gap-2">
              {error.includes('sign out') && (
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              )}
              {step === 1 && (
                <button
                  onClick={loadRepositories}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <Step1SelectRepos
              repositories={filteredRepos}
              selectedRepos={selectedRepos}
              toggleRepo={toggleRepo}
              loading={loading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onRetry={loadRepositories}
            />
          )}

          {step === 2 && (
            <Step2Connecting
              selectedRepos={Array.from(selectedRepos)
                .map((id) => repositories.find((r) => r.id === id))
                .filter((r): r is GitHubRepo => r !== undefined)}
              connectedRepos={connectedRepos}
              failedRepos={failedRepos}
              connecting={connecting}
            />
          )}

          {step === 3 && (
            <Step3Complete 
              connectedCount={connectedRepos.size}
              failedCount={failedRepos.size}
              onClose={onClose} 
            />
          )}
        </div>

        {/* Footer */}
        {step === 1 && (
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedRepos.size} {selectedRepos.size === 1 ? 'repository' : 'repositories'}{' '}
              selected
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={selectedRepos.size === 0 || loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Connect {selectedRepos.size > 0 && `(${selectedRepos.size})`}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Step components remain the same as before...
function Step1SelectRepos({
  repositories,
  selectedRepos,
  toggleRepo,
  loading,
  searchQuery,
  setSearchQuery,
  onRetry,
}: {
  repositories: GitHubRepo[];
  selectedRepos: Set<number>;
  toggleRepo: (id: number) => void;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading your repositories from GitHub...</p>
        <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {repositories.length === 0 ? (
        <div className="text-center py-12">
          <Github className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No repositories found</p>
          <p className="text-sm text-gray-500 mb-4">
            Make sure you have repositories in your GitHub account
          </p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2">
          {repositories.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={{
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description ?? undefined,
    language: repo.language ?? undefined,
    default_branch: repo.default_branch,
    updated_at: repo.updated_at,
    private: repo.private,
    stargazers_count: repo.stargazers_count,
  }}
              isSelected={selectedRepos.has(repo.id)}
              onSelect={toggleRepo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Step2Connecting({
  selectedRepos,
  connectedRepos,
  failedRepos,
  connecting,
}: {
  selectedRepos: GitHubRepo[];
  connectedRepos: Set<number>;
  failedRepos: Set<number>;
  connecting: boolean;
}) {
  return (
    <ConnectionProgress
      repos={selectedRepos}
      connectedRepos={connectedRepos}
      failedRepos={failedRepos}
      connecting={connecting}
    />
  );
}

function Step3Complete({ 
  connectedCount,
  failedCount,
  onClose 
}: { 
  connectedCount: number;
  failedCount: number;
  onClose: () => void;
}) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Sparkles className="w-10 h-10 text-green-600" />
      </div>
      
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        All Set! 🎉
      </h3>
      
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {connectedCount === 1 
          ? 'Your repository has been connected successfully.'
          : `${connectedCount} repositories have been connected successfully.`}
        {failedCount > 0 && (
          <span className="block mt-2 text-red-600">
            {failedCount} {failedCount === 1 ? 'repository' : 'repositories'} failed to connect.
          </span>
        )}
      </p>

      <div className="space-y-4 max-w-md mx-auto mb-8">
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Webhooks configured</p>
            <p className="text-sm text-blue-700">We'll track all changes automatically</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Initial analysis started</p>
            <p className="text-sm text-blue-700">Documentation will be ready shortly</p>
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        View Repositories
      </button>
    </div>
  );
}