'use client';

import React, { useState } from 'react';
import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfileDropdown from '@/components/Auth/UserProfileDropdown';
import DocumentationViewer from '@/components/Documentation/DocViewer';
import OverviewTab from '@/components/Documentation/OverviewTab';
import RepositoriesTab from '@/components/Documentation/RepositoriesTab';
import DocumentationTab from '@/components/Documentation/DocumentationTab';
import MetricsTab from '@/components/Documentation/MetricsTab';
import { useDocumentation, JobResult } from '@/hooks/useDocumentation';
import { useRepositories } from '@/hooks/useRepositories';
import { useMetrics } from '@/hooks/useMetrics';
import { 
  FileText, 
  Activity, 
  GitBranch, 
  BookOpen, 
  BarChart3,
  Loader2,
  Clock,
  DollarSign,
  TrendingUp
} from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDoc, setSelectedDoc] = useState<JobResult | null>(null);
  
  const { repositories, loading: reposLoading } = useRepositories();
  const { documents, loading: docsLoading } = useDocumentation();
  const { metrics, loading: metricsLoading } = useMetrics();

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
                  <h1 className="text-2xl font-bold text-gray-900">AI DocGen</h1>
                  <p className="text-sm text-gray-500">Dashboard</p>
                </div>
              </div>
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'repositories', label: 'Repositories', icon: GitBranch },
                { id: 'documentation', label: 'Documentation', icon: BookOpen },
                { id: 'metrics', label: 'Metrics', icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-4 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'overview' && (
            <OverviewTab metrics={metrics} repositories={repositories} documents={documents} />
          )}
          {activeTab === 'repositories' && (
            <RepositoriesTab repositories={repositories} loading={reposLoading} />
          )}
          {activeTab === 'documentation' && (
            <DocumentationTab 
              documents={documents} 
              loading={docsLoading}
              onSelectDocument={setSelectedDoc}
            />
          )}
          {activeTab === 'metrics' && (
            <MetricsTab metrics={metrics} loading={metricsLoading} />
          )}
        </main>

        {/* Document Viewer Modal */}
        {selectedDoc && (
          <DocumentationViewer
            document={selectedDoc}
            onClose={() => setSelectedDoc(null)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}