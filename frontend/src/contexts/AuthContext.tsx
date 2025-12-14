// frontend/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  UserCredential,
} from 'firebase/auth';
import { auth, githubProvider, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGithub: () => Promise<UserCredential>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGithub: async () => {
    throw new Error('AuthContext not initialized');
  },
  signOut: async () => {
    throw new Error('AuthContext not initialized');
  },
  error: null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔥 Setting up auth state listener');

    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        console.log('🔥 Auth state changed:', user ? user.email : 'No user');
        setUser(user);
        setLoading(false);

        // Create/update user document in Firestore
        if (user) {
          try {
            await updateUserDocument(user);
          } catch (err) {
            console.error('❌ Failed to update user document:', err);
          }
        }
      },
      (error) => {
        console.error('❌ Auth state error:', error);
        setLoading(false);
      }
    );

    return () => {
      console.log('🔥 Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const signInWithGithub = async (): Promise<UserCredential> => {
    try {
      setError(null);
      setLoading(true);

      console.log('🔐 Starting GitHub sign-in...');
      const result = await signInWithPopup(auth, githubProvider);

      console.log('✅ Signed in successfully:', result.user.email);
      return result;
    } catch (err: any) {
      console.error('❌ GitHub sign-in error:', err);

      let errorMessage = 'Failed to sign in with GitHub';

      // Handle specific error codes
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in popup was closed before completing authentication';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked by your browser. Please allow popups for this site.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Another sign-in popup is already open';
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized. Add it in Firebase Console.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'GitHub authentication is not enabled in Firebase Console';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> =>{
    try {
      setError(null);
      console.log('🚪 Signing out...');
      await firebaseSignOut(auth);
      console.log('✅ Signed out successfully');
    } catch (err: any) {
      console.error('❌ Sign-out error:', err);
      setError('Failed to sign out');
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGithub,
    signOut,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Update user document in Firestore
 * Creates new document on first sign-in, updates on subsequent sign-ins
 */
async function updateUserDocument(user: User): Promise<void> {
  try {
    const userRef = doc(db, 'users', user.uid);

    // Check if user document exists
    const userSnap = await getDoc(userRef);

    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!userSnap.exists()) {
      // Create new user document
      await setDoc(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
        repositories: [],
        preferences: {
          theme: 'light',
          notifications: true,
          emailUpdates: false,
        },
        stats: {
          totalRepos: 0,
          totalDocs: 0,
          lastActiveAt: serverTimestamp(),
        },
      });
      console.log('✅ Created new user document:', user.uid);
    } else {
      // Update existing user document (merge to preserve other fields)
      await setDoc(userRef, userData, { merge: true });
      console.log('✅ Updated user document:', user.uid);
    }
  } catch (error) {
    console.error('❌ Error updating user document:', error);
    throw error;
  }
}