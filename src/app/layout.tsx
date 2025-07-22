// src/app/layout.tsx
import './globals.css'
import './styles/legacy-hub.css'
import './styles/avatar-sharing.css'
import { ReactNode } from 'react'
import SupabaseProvider from '@/components/SupabaseProvider'
import Navigation from '@/components/nav'

export const metadata = {
  title: 'EchoStone',
  description: 'AI-powered voice interaction platform',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          <Navigation />
          <main className="main-content">
            {children}
          </main>
        </SupabaseProvider>
      </body>
    </html>
  )
}