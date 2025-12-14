// frontend/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI DocGen - Intelligent Documentation Platform',
  description: 'Automatically generate and maintain technical documentation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}