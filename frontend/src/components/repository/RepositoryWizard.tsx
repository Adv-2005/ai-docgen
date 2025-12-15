// frontend/components/Repository/RepositoryWizard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Loader2,
  Github,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchGitHubRepositories, setupWebhook, triggerInitialAnalysis, GitHubRepo } from '@/lib/github';
import { addRepository } from '@/lib/firestore';

interface RepositoryWizardProps {
  onClose: () => void;
  onComplete?: () => void;
}

export default function RepositoryWizard({ onClose, onComplete }: RepositoryWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectedRepos, setConnectedRepos] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 1 && repositories.length === 0) {
      loadRepositories();
    }
  }, [step]);

  const loadRepositories = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const repos = await fetchGitHubRepositories(user);
      setRepositories(repos);
    } catch (err: any) {
      console.error('Failed to load repositories:', err);
      setError('Failed to load repositories. Please try again.');
    } finally {
      setLoading(false);
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

    try {
      // Connect each selected repository
      for (const repoId of selectedRepos) {
        const repo = repositories.find((r) => r.id === repoId);
        if (!repo) continue;

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

        // Small delay between repos
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setConnecting(false);
      setStep(3);

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('Failed to connect repositories:', err);
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
            />
          )}

          {step === 2 && (
            <Step2Connecting
              selectedRepos={Array.from(selectedRepos)
                .map((id) => repositories.find((r) => r.id === id))
                .filter((r): r is GitHubRepo => r !== undefined)}
              connectedRepos={connectedRepos}
              connecting={connecting}
            />
          )}

          {step === 3 && <Step3Complete count={selectedRepos.size} onClose={onClose} />}
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
                disabled={selectedRepos.size === 0}
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

// Sub-components remain the same as in the demo
// Copy them from the interactive artifact above