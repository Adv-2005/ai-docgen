// frontend/src/hooks/useMetrics.ts
import { useState, useEffect } from 'react';

interface Metrics {
  current: {
    webhooks: {
      total: number;
      byType: Record<string, number>;
    };
    jobs: {
      total: number;
      byStatus: Record<string, number>;
      successRate: number;
    };
  };
  recent: {
    jobs: Array<{
      id: string;
      jobType: string;
      status: string;
      repoFullName: string;
      createdAt: any;
    }>;
  };
  history: Array<{
    date: string;
    webhooks: { total: number };
    jobs: { total: number; successRate: number };
  }>;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Call your getMetrics Cloud Function
        const functionsUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 
          'http://127.0.0.1:5001/ai-docgen-44b16/us-central1';
        
        const response = await fetch(`${functionsUrl}/getMetrics`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.status}`);
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { metrics, loading, error };
}