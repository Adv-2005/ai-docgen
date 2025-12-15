// frontend/hooks/useRepositories.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRepositories,
  subscribeToRepositories,
  Repository,
} from '@/lib/firestore';

export function useRepositories() {
  const { user } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRepositories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = subscribeToRepositories(user.uid, (repos) => {
      setRepositories(repos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return {
    repositories,
    loading,
    error,
  };
}