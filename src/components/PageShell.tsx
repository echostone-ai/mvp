// src/components/PageShell.tsx
import React from 'react'
import AccountMenu from './AccountMenu'

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell" style={{ minHeight: '100vh', width: '100vw', position: 'relative' }}>
      {/* Absolutely position the AccountMenu in top-right */}
      <div
        style={{
          position: 'fixed',
          top: '2.2rem',
          right: '2.2rem',
          zIndex: 1000,
        }}
      >
        <AccountMenu />
      </div>
      <main className="main-content" style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        margin: 0,
      }}>
        {children}
      </main>
    </div>
  )
}