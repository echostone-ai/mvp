// src/app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'
import SupabaseProvider from '@/components/SupabaseProvider'

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
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}