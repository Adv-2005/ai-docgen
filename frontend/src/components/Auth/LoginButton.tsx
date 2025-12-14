// components/Auth/LoginButton.tsx
import { signInWithPopup } from 'firebase/auth';
import { auth, githubProvider } from '@/lib/firebase';

export function LoginButton() {
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, githubProvider);
      // User signed in
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return <button onClick={handleLogin}>Sign in with GitHub</button>;
}