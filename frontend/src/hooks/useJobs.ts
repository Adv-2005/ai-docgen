// hooks/useJobs.ts
import { useState, useEffect } from 'react';
import { subscribeToJobs } from '@/lib/firestore';

export function useJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToJobs((newJobs) => {
      setJobs(newJobs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { jobs, loading };
}