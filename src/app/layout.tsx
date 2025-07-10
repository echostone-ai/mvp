// src/app/layout.tsx
import './globals.css'
import type { ReactNode } from 'react'
import PageShell from '@/components/PageShell'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PageShell>
          {children}
        </PageShell>
      </body>
    </html>
  )
}