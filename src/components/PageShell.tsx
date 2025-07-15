// src/components/PageShell.tsx
import React from 'react'
import AccountMenu from './AccountMenu'

export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-screen relative">
      {/* Account menu positioned in top-right */}
      <div className="fixed top-9 right-9 z-50">
        <AccountMenu />
      </div>
      <main className="min-h-screen w-screen flex flex-col items-center justify-center p-0 m-0">
        {children}
      </main>
    </div>
  )
}