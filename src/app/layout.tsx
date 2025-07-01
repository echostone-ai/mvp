// src/app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'EchoStone',
  description:
    'Interact with your AI-powered legacy avatar of Jonathan Braden—ask questions by typing or speaking!',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts: Poppins for text */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
