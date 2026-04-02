'use client';

import { useState } from 'react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfileDropdown from '@/components/Auth/UserProfileDropdown';
import RepositoryWizard from '@/components/repository/RepositoryWizard';
import DocumentationModal from '@/components/Documentation/DocumentationModal';
import { useRepositories } from '@/hooks/useRepositories';
import { triggerDocumentationGeneration } from '@/lib/github';
import { FileText, Github, Loader2, Plus } from 'lucide-react';
import GitHubDebug from '@/components/debug/GitHubDebug';


export default function RepositoriesPage() {
  const [showWizard, setShowWizard] = useState(false);
  const { repositories, loading } = useRepositories();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Repositories</h1>
                  <p className="text-sm text-gray-500">Manage your connected repositories</p>
                </div>
              </div>
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        {/* Main Content */}
        {/* <GitHubDebug /> */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Connected Repositories ({repositories.length})
            </h2>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Repository
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : repositories.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Github className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Repositories Connected
              </h3>
              <p className="text-gray-600 mb-6">
                Connect your first repository to start generating documentation
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Connect Repository
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {repositories.map((repo) => (
                <RepoCard key={repo.id} repo={repo} />
              ))}
            </div>
          )}
        </main>
      </div>

      {showWizard && (
        <RepositoryWizard
          onClose={() => setShowWizard(false)}
          onComplete={() => {
            setShowWizard(false);
            // Repositories will auto-update via real-time subscription
          }}
        />
      )}
    </ProtectedRoute>
  );
}

function RepoCard({ repo }: { repo: any }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  const handleGenerateDocs = async () => {
    setIsGenerating(true);
    try {
      // Trigger documentation generation
      await triggerDocumentationGeneration(repo.repoFullName, 'full-analysis');
      console.log('✅ Documentation generation started for:', repo.repoFullName);
      // Show success message or redirect to docs
    } catch (error) {
      console.error('❌ Failed to generate documentation:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewDocs = () => {
    setShowDocModal(true);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{repo.name}</h3>
          <p className="text-sm text-gray-600">{repo.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleViewDocs}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Documentation"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={handleGenerateDocs}
            disabled={isGenerating}
            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
            title="Generate Documentation"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Documentation Coverage</span>
          <span className="font-semibold">{repo.stats?.coverage || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${repo.stats?.coverage || 0}%` }}
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Documents</p>
          <p className="font-semibold">{repo.stats?.docsCount || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Files</p>
          <p className="font-semibold">{repo.stats?.filesAnalyzed || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Last Updated</p>
          <p className="font-semibold text-xs text-gray-600">
            {repo.lastAnalyzed ? new Date(repo.lastAnalyzed).toLocaleDateString() : 'Never'}
          </p>
        </div>
      </div>

      {/* Documentation Quick Actions */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleGenerateSpecificDoc('architecture')}
            className="flex items-center justify-center gap-1 px-3 py-2 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
          >
            <FileText className="w-3 h-3" />
            Architecture
          </button>
          <button
            onClick={() => handleGenerateSpecificDoc('api')}
            className="flex items-center justify-center gap-1 px-3 py-2 text-xs bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors"
          >
            <FileText className="w-3 h-3" />
            API Docs
          </button>
        </div>
      </div>

      {/* Documentation Modal */}
      {showDocModal && (
        <DocumentationModal
          repoFullName={repo.repoFullName}
          onClose={() => setShowDocModal(false)}
        />
      )}
    </div>
  );

  async function handleGenerateSpecificDoc(type: 'architecture' | 'api' | 'onboarding' | 'change-summary') {
    setIsGenerating(true);
    try {
      await triggerDocumentationGeneration(repo.repoFullName, type);
      console.log(`✅ ${type} documentation generation started for:`, repo.repoFullName);
    } catch (error) {
      console.error(`❌ Failed to generate ${type} documentation:`, error);
    } finally {
      setIsGenerating(false);
    }
  }
}