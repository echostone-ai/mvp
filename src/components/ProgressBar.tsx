import './globals.css'
import { ReactNode } from 'react'
import SupabaseProvider from '../components/SupabaseProvider'

export const metadata = {
  title: 'EchoStone',
  description: 'Your portal for digital echoes',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  )
}