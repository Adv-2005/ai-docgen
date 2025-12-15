// frontend/src/components/repository/ConnectionProgress.tsx
import React from 'react';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ConnectionProgressProps {
  repos: Array<{
    id: number;
    name: string;
    full_name: string;
  }>;
  connectedRepos: Set<number>;
  failedRepos?: Set<number>;
  connecting: boolean;
}

export default function ConnectionProgress({ 
  repos, 
  connectedRepos, 
  failedRepos = new Set(),
  connecting 
}: ConnectionProgressProps) {
  const totalRepos = repos.length;
  const connectedCount = connectedRepos.size;
  const failedCount = failedRepos.size;
  const progressPercent = Math.round((connectedCount / totalRepos) * 100);

  return (
    <div className="space-y-6">
      {/* Overall Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            Connecting repositories...
          </span>
          <span className="text-gray-600">
            {connectedCount} / {totalRepos}
          </span>
        </div>
        
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Repository List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {repos.map((repo) => {
          const isConnected = connectedRepos.has(repo.id);
          const isFailed = failedRepos.has(repo.id);
          const isPending = !isConnected && !isFailed && connecting;

          return (
            <div
              key={repo.id}
              className={`
                flex items-center gap-3 p-4 rounded-lg border-2 transition-all
                ${isConnected 
                  ? 'border-green-200 bg-green-50' 
                  : isFailed
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-white'
                }
              `}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {isConnected ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : isFailed ? (
                  <XCircle className="w-6 h-6 text-red-600" />
                ) : isPending ? (
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                ) : (
                  <Clock className="w-6 h-6 text-gray-400" />
                )}
              </div>

              {/* Repo Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {repo.name}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {repo.full_name}
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex-shrink-0">
                {isConnected ? (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Connected
                  </span>
                ) : isFailed ? (
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                    Failed
                  </span>
                ) : isPending ? (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    Connecting...
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                    Pending
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {(connectedCount > 0 || failedCount > 0) && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-6 text-sm">
            {connectedCount > 0 && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-gray-700">
                  <span className="font-semibold text-green-600">{connectedCount}</span> connected
                </span>
              </div>
            )}
            
            {failedCount > 0 && (
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-gray-700">
                  <span className="font-semibold text-red-600">{failedCount}</span> failed
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}