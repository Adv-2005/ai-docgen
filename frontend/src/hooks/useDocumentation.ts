// frontend/src/hooks/useDocumentation.ts
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DocumentationResult {
  id: string;
  type: 'onboarding' | 'architecture' | 'api' | 'change-summary' | 'pr-summary';
  title: string;
  content: string;
  metadata: {
    generatedAt: Date;
    model: string;
    tokensUsed?: number;
  };
  repoFullName?: string;
  prNumber?: number;
}

export interface JobResult {
  id: string;
  jobId: string;
  repoId: string;
  prNumber?: number;
  status: 'completed' | 'failed';
  analysis: {
    type: string;
    filesChanged?: number;
    documentation?: DocumentationResult;
  };
  createdAt: Date;
}

export function useDocumentation(repoId?: string) {
  const [documents, setDocuments] = useState<JobResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    
    // Query jobResults collection
    let q = query(
      collection(db, 'jobResults'),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc')
    );

    if (repoId) {
      q = query(q, where('repoId', '==', repoId));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as JobResult[];
        
        setDocuments(docs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching documentation:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [repoId]);

  return { documents, loading, error };
}

// Hook to get specific documentation by ID
export function useDocumentById(docId: string) {
  const [document, setDocument] = useState<JobResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const docRef = collection(db, 'jobResults');
        const snapshot = await getDocs(query(docRef, where('id', '==', docId)));
        
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setDocument({
            id: snapshot.docs[0].id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as JobResult);
        }
      } catch (err) {
        console.error('Error fetching document:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docId]);

  return { document, loading };
}