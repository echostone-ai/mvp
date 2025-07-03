// src/components/PageShell.tsx
'use client'

import React, { ReactNode, useEffect } from 'react'
import Head from 'next/head'

interface PageShellProps {
  title: string
  children: ReactNode
}

export default function PageShell({ title, children }: PageShellProps) {
  useEffect(() => {
    document.title = title
  }, [title])

  return (
    <>
      <Head>
        <meta name="description" content="EchoStone — ask Jonathan anything" />
      </Head>
      <main
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(circle at center, #6b21a8 0%, #4c1d95 60%, #1e1b29 100%)',
          color: '#f3f4f6',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'Poppins, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </main>
    </>
  )
}
