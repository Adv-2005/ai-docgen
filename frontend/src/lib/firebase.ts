// frontend/src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GithubAuthProvider } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth (PRODUCTION - NO EMULATOR)
// This ensures we get real GitHub OAuth tokens
export const auth = getAuth(app);

// Initialize Firestore
export const db = getFirestore(app);

// GitHub Provider with required scopes
export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('repo'); // Access to repositories
githubProvider.addScope('read:user'); // Read user profile
githubProvider.addScope('user:email'); // Read user email

// Connect to Firestore emulator ONLY (not Auth emulator)
// This gives us local data storage while using real GitHub OAuth
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
  
  if (useEmulator && getApps().length === 1) {
    try {
      // ❌ DELIBERATELY NOT connecting to Auth emulator
      // We need real GitHub tokens, not fake emulator tokens
      
      // ✅ DO connect to Firestore emulator for local data storage
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      
      console.log('🔥 Firebase initialized:');
      console.log('  - Auth: PRODUCTION (real GitHub OAuth tokens)');
      console.log('  - Firestore: EMULATOR (local data storage)');
    } catch (error) {
      console.log('⚠️ Emulator already connected or unavailable');
    }
  } else {
    console.log('🔥 Firebase initialized: PRODUCTION MODE');
  }
}

export default app;