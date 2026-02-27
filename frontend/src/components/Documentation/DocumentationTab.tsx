import React, { useState } from 'react';
import { Github, FileText, TrendingUp, Settings, ExternalLink, RefreshCw } from 'lucide-react';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  language?: string;
  stats: {
    coverage: number;
    docsCount: number;
    filesAnalyzed: number;
  };
  lastAnalyzed?: string;
  isActive: boolean;
}

interface RepositoriesTabProps {
  repositories?: Repository[];
  onViewDocs?: (repoId: string) => void;
  onConfigure?: (repoId: string) => void;
  onRefresh?: (repoId: string) => void;
}

function RepositoryCard({ 
  repo, 
  onViewDocs, 
  onConfigure, 
  onRefresh 
}: { 
  repo: Repository; 
  onViewDocs?: (id: string) => void;
  onConfigure?: (id: string) => void;
  onRefresh?: (id: string) => void;
}) {
  const getCoverageColor = (coverage: number) => {
    if (coverage >= 70) return 'bg-green-600';
    if (coverage >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getLanguageColor = (language?: string) => {
    const colors: Record<string, string> = {
      'TypeScript': 'bg-blue-100 text-blue-800',
      'JavaScript': 'bg-yellow-100 text-yellow-800',
      'Python': 'bg-green-100 text-green-800',
      'Java': 'bg-red-100 text-red-800',
      'Go': 'bg-cyan-100 text-cyan-800',
    };
    return colors[language || ''] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Github className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{repo.name}</h3>
            <p className="text-sm text-gray-500 truncate">{repo.fullName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {repo.language && (
            <span className={`px-2 py-1 text-xs font-medium rounded ${getLanguageColor(repo.language)}`}>
              {repo.language}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{repo.description}</p>
      )}

      {/* Coverage */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Documentation Coverage</span>
          <span className="font-semibold text-gray-900">{repo.stats.coverage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${getCoverageColor(repo.stats.coverage)}`}
            style={{ width: `${repo.stats.coverage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-gray-200">
        <div>
          <p className="text-xs text-gray-500 mb-1">Documents</p>
          <p className="text-lg font-bold text-gray-900">{repo.stats.docsCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Files Analyzed</p>
          <p className="text-lg font-bold text-gray-900">{repo.stats.filesAnalyzed}</p>
        </div>
      </div>

      {/* Last Analyzed */}
      {repo.lastAnalyzed && (
        <p className="text-xs text-gray-500 mb-4">
          Last analyzed: {repo.lastAnalyzed}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onViewDocs?.(repo.id)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <FileText className="w-4 h-4" />
          View Docs
        </button>
        <button
          onClick={() => onRefresh?.(repo.id)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          title="Refresh analysis"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => onConfigure?.(repo.id)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          title="Configure"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function RepositoriesTab({
  repositories = [
    {
      id: '1',
      name: 'ai-docgen',
      fullName: 'user/ai-docgen',
      description: 'AI-powered documentation generator with semantic code analysis',
      language: 'TypeScript',
      stats: { coverage: 75, docsCount: 48, filesAnalyzed: 64 },
      lastAnalyzed: '2 hours ago',
      isActive: true,
    },
    {
      id: '2',
      name: 'WanderLust',
      fullName: 'Adv-2005/WanderLust',
      description: 'Travel booking platform with real-time availability',
      language: 'JavaScript',
      stats: { coverage: 62, docsCount: 31, filesAnalyzed: 50 },
      lastAnalyzed: '1 day ago',
      isActive: true,
    },
    {
      id: '3',
      name: 'api-server',
      fullName: 'user/api-server',
      description: 'RESTful API server with GraphQL support',
      language: 'TypeScript',
      stats: { coverage: 88, docsCount: 25, filesAnalyzed: 28 },
      lastAnalyzed: '3 hours ago',
      isActive: true,
    },
  ],
  onViewDocs,
  onConfigure,
  onRefresh,
}: RepositoriesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');

  const filteredRepos = repositories.filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         repo.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLanguage = filterLanguage === 'all' || repo.language === filterLanguage;
    return matchesSearch && matchesLanguage;
  });

  const languages = ['all', ...new Set(repositories.map(r => r.language).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Your Repositories</h2>
        <p className="text-blue-100 mb-4">
          {repositories.length} connected repositories generating documentation automatically
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-blue-100">Total Documents</p>
            <p className="text-2xl font-bold">
              {repositories.reduce((sum, r) => sum + r.stats.docsCount, 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-blue-100">Avg Coverage</p>
            <p className="text-2xl font-bold">
              {Math.round(repositories.reduce((sum, r) => sum + r.stats.coverage, 0) / repositories.length)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-blue-100">Files Analyzed</p>
            <p className="text-2xl font-bold">
              {repositories.reduce((sum, r) => sum + r.stats.filesAnalyzed, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterLanguage}
          onChange={(e) => setFilterLanguage(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {languages.map(lang => (
            <option key={lang} value={lang}>
              {lang === 'all' ? 'All Languages' : lang}
            </option>
          ))}
        </select>
      </div>

      {/* Repository Grid */}
      {filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepos.map((repo) => (
            <RepositoryCard
              key={repo.id}
              repo={repo}
              onViewDocs={onViewDocs}
              onConfigure={onConfigure}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Github className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No repositories found matching your search</p>
        </div>
      )}
    </div>
  );
}