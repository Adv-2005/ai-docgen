// frontend/app/page.tsx
'use client';

import ProtectedRoute from '@/components/Auth/ProtectedRoute';
import UserProfileDropdown from '@/components/Auth/UserProfileDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { FileText } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();

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
                  <p className="text-sm text-gray-500">Intelligent Documentation Platform</p>
                </div>
              </div>
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome, {user?.displayName || 'Developer'}!
            </h2>
            <p className="text-gray-600 mb-6">
              You're successfully authenticated. Your dashboard is ready.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Authentication Active
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}