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
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGitHub = async () => {
    try {
      const provider = new GithubAuthProvider();
      
      // Request additional GitHub scopes
      provider.addScope('repo'); // Access to repositories
      provider.addScope('read:user'); // Read user profile
      provider.addScope('user:email'); // Read user email
      
      const result = await signInWithPopup(auth, provider);
      
      // Get the GitHub access token from the credential
      const credential = GithubAuthProvider.credentialFromResult(result);
      const githubAccessToken = credential?.accessToken;

      if (githubAccessToken && result.user) {
        // Store the GitHub access token in Firestore
        await storeGitHubToken(result.user.uid, githubAccessToken);
        
        console.log('✅ GitHub token stored successfully');
      } else {
        console.warn('⚠️ No GitHub access token received');
      }
      
    } catch (error: any) {
      console.error('Error signing in with GitHub:', error);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-blocked') {
        alert('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        console.log('User closed the popup');
      } else {
        alert('Failed to sign in with GitHub. Please try again.');
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGitHub,
    signOut,
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
 * Store GitHub access token in Firestore
 */
async function storeGitHubToken(uid: string, githubAccessToken: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    
    // Check if user document exists
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      // Update existing document
      await setDoc(userRef, {
        githubAccessToken,
        githubTokenUpdatedAt: new Date(),
      }, { merge: true });
    } else {
      // Create new document
      await setDoc(userRef, {
        uid,
        githubAccessToken,
        githubTokenUpdatedAt: new Date(),
        createdAt: new Date(),
      });
    }
    
    console.log('GitHub token stored in Firestore for user:', uid);
  } catch (error) {
    console.error('Error storing GitHub token:', error);
    throw error;
  }
}