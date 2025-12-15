// frontend/src/components/repository/RepoCard.tsx
import React from 'react';
import { Github, GitBranch, Code, Calendar } from 'lucide-react';

interface RepoCardProps {
  repo: {
    id: number;
    name: string;
    full_name: string;
    description?: string;
    language?: string;
    default_branch: string;
    updated_at: string;
    private: boolean;
    stargazers_count?: number;
  };
  isSelected?: boolean;
  onSelect?: (repoId: number) => void;
  showActions?: boolean;
}

export default function RepoCard({ 
  repo, 
  isSelected = false, 
  onSelect,
  showActions = true 
}: RepoCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(repo.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative p-5 rounded-xl border-2 transition-all cursor-pointer
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-lg' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }
      `}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Github className="w-5 h-5 text-gray-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {repo.name}
          </h3>
          <p className="text-sm text-gray-500 truncate">
            {repo.full_name}
          </p>
        </div>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {repo.description}
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {repo.language && (
          <div className="flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5" />
            <span>{repo.language}</span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5" />
          <span>{repo.default_branch}</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(repo.updated_at)}</span>
        </div>
      </div>

      {/* Privacy Badge */}
      {repo.private && (
        <div className="absolute bottom-3 right-3">
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
            Private
          </span>
        </div>
      )}
    </div>
  );
}