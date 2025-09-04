// src/app/layout.tsx
import './globals.css';
import '@/styles/avatar-sharing.css';
import type { Metadata } from 'next';
import AuthHashHandler from '@/components/AuthHashHandler';
import AppHeader from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'EchoStone',
  description: 'Your digital memory companion',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthHashHandler />
        <AppHeader />
        <div style={{ paddingTop: 72 }}>
          {children}
        </div>
      </body>
    </html>
  );
}