// src/app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'
import SupabaseProvider from '@/components/SupabaseProvider'

export const metadata = {
  title: 'EchoStone',
  description: '…',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google fonts */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap"
        />
      </head>
      <body>
        {/* Only this part runs client-side */}
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}
