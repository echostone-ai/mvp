// src/app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'
import SupabaseProvider from '@/components/SupabaseProvider'

export const metadata = {
  title: 'EchoStone',
  description: 'AI-powered voice interaction platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}