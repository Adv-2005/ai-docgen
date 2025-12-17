// frontend/src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GithubAuthProvider,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null; // ✅ ADDED: Error state
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void; // ✅ ADDED: Clear error function
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ ADDED: Error state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGitHub = async () => {
    setError(null); // Clear previous errors
    setLoading(true);
    
    try {
      const provider = new GithubAuthProvider();
      
      // ✅ CRITICAL: Request repo scope for accessing repositories
      provider.addScope('repo');
      provider.addScope('read:user');
      provider.addScope('user:email');
      
      console.log('🔐 Starting GitHub OAuth flow...');
      
      const result = await signInWithPopup(auth, provider);
      
      // ✅ CRITICAL: Get the GitHub access token
      const credential = GithubAuthProvider.credentialFromResult(result);
      const githubAccessToken = credential?.accessToken;

      console.log('✅ OAuth successful:', {
        userId: result.user.uid,
        hasToken: !!githubAccessToken,
        tokenPrefix: githubAccessToken?.substring(0, 10) + '...',
      });

      if (githubAccessToken && result.user) {
        // ✅ CRITICAL: Store token in Firestore
        await storeGitHubToken(result.user.uid, githubAccessToken);
        console.log('✅ GitHub token stored in Firestore');
      } else {
        console.error('❌ No GitHub access token received from OAuth');
        setError('Failed to get GitHub access token. Please try again.');
      }
      
    } catch (error: any) {
      console.error('❌ GitHub sign-in error:', error);
      
      let errorMessage = 'Failed to sign in with GitHub';
      
      if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups for this site.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in cancelled';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      console.log('✅ Signed out successfully');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      setError('Failed to sign out');
      throw error;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signInWithGitHub,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * ✅ CRITICAL: Store GitHub access token in Firestore
 */
async function storeGitHubToken(uid: string, githubAccessToken: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    
    // Check if user document exists
    const userSnap = await getDoc(userRef);
    
    const userData = {
      githubAccessToken,
      githubTokenUpdatedAt: new Date(),
      lastLoginAt: new Date(),
    };
    
    if (userSnap.exists()) {
      // Update existing document
      await setDoc(userRef, userData, { merge: true });
      console.log('✅ Updated existing user document with GitHub token');
    } else {
      // Create new document
      await setDoc(userRef, {
        uid,
        ...userData,
        createdAt: new Date(),
      });
      console.log('✅ Created new user document with GitHub token');
    }
    
  } catch (error) {
    console.error('❌ Error storing GitHub token in Firestore:', error);
    throw error;
  }
}