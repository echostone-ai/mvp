// src/components/PageShell.tsx
import React from 'react'
import AccountMenu from './AccountMenu'
import Link from 'next/link'
import Image from 'next/image'

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
      {/* Navigation Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(15, 15, 35, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '32px 24px' // Increased padding for larger logo
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* Logo */}
          <Link href="/" style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit'
          }}>
            <Image
              src="/echostone_logo.png"
              alt="EchoStone"
              width={100}
              height={100}
              style={{
                borderRadius: '16px',
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.3)'
              }}
            />
          </Link>

          {/* Account Menu */}
          <AccountMenu />
        </div>
      </header>

      {/* Main Content with top padding for fixed header */}
      <main style={{ 
        flex: 1, 
        width: '100%', 
        paddingTop: '180px', // Increased padding for larger header logo
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