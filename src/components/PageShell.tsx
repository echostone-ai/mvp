// src/components/PageShell.tsx
import React from 'react'
import AccountMenu from './AccountMenu'

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      backgroundAttachment: 'fixed'
    }}>
      {/* Account menu positioned in top-right */}
      <div className="fixed top-9 right-9 z-50">
        <AccountMenu />
      </div>
      <main className="flex-1 w-screen p-0 m-0">
        {children}
      </main>
      {/* Footer */}
      <footer style={{ 
        width: '100%', 
        backgroundColor: 'rgba(0, 0, 0, 0.3)', 
        backdropFilter: 'blur(4px)', 
        borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
        padding: '16px 24px', 
        textAlign: 'center' as const,
        marginTop: 'auto'
      }}>
        <p style={{ 
          fontSize: '14px', 
          color: '#9ca3af', 
          margin: 0 
        }}>
          © 2025 EchoStone. All rights reserved.
        </p>
      </footer>
    </div>
  )
}