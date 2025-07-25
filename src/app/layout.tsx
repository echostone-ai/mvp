// src/app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import ParticleBackground from '@/components/ParticleBackground';

export const metadata: Metadata = {
  title: 'EchoStone',
  description: 'Your digital memory companion',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ParticleBackground />
        {children}
      </body>
    </html>
  );
}