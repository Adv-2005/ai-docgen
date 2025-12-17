// frontend/src/lib/firestore.ts
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Repository {
  id?: string;
  userId: string;
  repoId: string;
  repoFullName: string;
  ownerLogin: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  language?: string;
  defaultBranch: string;
  webhookId: string;
  webhookSecret: string;
  isActive: boolean;
  lastAnalyzedAt?: Timestamp | Date | FieldValue;
  createdAt: Timestamp | Date | FieldValue;
  updatedAt: Timestamp | Date | FieldValue;
  stats?: {
    coverage: number;
    docsCount: number;
    filesAnalyzed: number;
  };
}

export interface Job {
  id?: string;
  jobType: 'initial-ingestion' | 'pr-analysis' | 'push-analysis';
  status: 'queued' | 'dispatched' | 'in-progress' | 'completed' | 'failed';
  repoId: string;
  repoFullName: string;
  prNumber?: number;
  createdAt: Timestamp | Date | FieldValue;
  updatedAt: Timestamp | Date | FieldValue;
  completedAt?: Timestamp | Date | FieldValue;
  error?: string;
  resultId?: string;
}

/**
 * ✅ FIXED: Remove undefined values before storing in Firestore
 */
function cleanData<T extends Record<string, any>>(data: T): Partial<T> {
  const cleaned: Partial<T> = {};
  
  for (const key in data) {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  
  return cleaned;
}

/**
 * Add a repository to Firestore
 */
export async function addRepository(
  userId: string,
  repoData: Omit<Repository, 'id' | 'userId' | 'isActive' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const repoRef = doc(collection(db, 'repositories'));
    
    // ✅ FIXED: Build repository object without undefined values
    const repository: Record<string, any> = {
      userId,
      repoId: repoData.repoId,
      repoFullName: repoData.repoFullName,
      ownerLogin: repoData.ownerLogin,
      name: repoData.name,
      isPrivate: repoData.isPrivate,
      defaultBranch: repoData.defaultBranch,
      webhookId: repoData.webhookId,
      webhookSecret: repoData.webhookSecret,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // ✅ Only add optional fields if they have values
    if (repoData.description !== undefined && repoData.description !== null) {
      repository.description = repoData.description;
    }
    
    if (repoData.language !== undefined && repoData.language !== null) {
      repository.language = repoData.language;
    }

    await setDoc(repoRef, repository);
    
    console.log('✅ Repository added to Firestore:', repoRef.id);
    return repoRef.id;
  } catch (error) {
    console.error('❌ Error adding repository:', error);
    throw error;
  }
}

/**
 * Get repositories for a user
 */
export async function getRepositories(userId: string): Promise<Repository[]> {
  try {
    const q = query(
      collection(db, 'repositories'),
      where('userId', '==', userId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Repository));
  } catch (error) {
    console.error('❌ Error fetching repositories:', error);
    throw error;
  }
}

/**
 * Subscribe to repositories for real-time updates
 */
export function subscribeToRepositories(
  userId: string,
  callback: (repos: Repository[]) => void
): () => void {
  const q = query(
    collection(db, 'repositories'),
    where('userId', '==', userId),
    where('isActive', '==', true),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const repos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Repository));
      callback(repos);
    },
    (error) => {
      console.error('❌ Error in repository subscription:', error);
    }
  );
}

/**
 * Subscribe to jobs for a repository
 */
export function subscribeToJobs(callback: (jobs: Job[]) => void): () => void {
  const q = query(
    collection(db, 'jobs'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const jobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Job));
      callback(jobs);
    },
    (error) => {
      console.error('❌ Error in jobs subscription:', error);
    }
  );
}

/**
 * Get a specific job by ID
 */
export async function getJob(jobId: string): Promise<Job | null> {
  try {
    const jobRef = doc(db, 'jobs', jobId);
    const jobSnap = await getDoc(jobRef);
    
    if (!jobSnap.exists()) {
      return null;
    }

    return {
      id: jobSnap.id,
      ...jobSnap.data(),
    } as Job;
  } catch (error) {
    console.error('❌ Error fetching job:', error);
    throw error;
  }
}

/**
 * Update repository stats
 */
export async function updateRepositoryStats(
  repoId: string,
  stats: Repository['stats']
): Promise<void> {
  try {
    const repoRef = doc(db, 'repositories', repoId);
    await setDoc(repoRef, {
      stats,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('❌ Error updating repository stats:', error);
    throw error;
  }
}