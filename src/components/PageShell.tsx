// src/components/PageShell.tsx
import React from 'react'
// Global header is rendered by RootLayout. Keep PageShell focused on layout spacing only.

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
      {/* Header is handled globally */}

      {/* Main Content with top padding for fixed header */}
      <main style={{ 
        flex: 1, 
        width: '100%', 
        paddingTop: '72px',
        paddingBottom: '80px' // Space for footer
      }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.3)', 
        backdropFilter: 'blur(4px)', 
        borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
        padding: '16px 24px', 
        textAlign: 'center' as const,
        zIndex: 40
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