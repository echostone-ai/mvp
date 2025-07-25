// src/app/layout.tsx
import './globals.css';
import '@/styles/avatar-sharing.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EchoStone',
  description: 'Your digital memory companion',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}