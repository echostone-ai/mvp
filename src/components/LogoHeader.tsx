'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function LogoHeader() {
  return (
    <Link
      href="/"
      style={{
        position: 'absolute',
        top: 24,
        right: 32,
        zIndex: 100,
        display: 'block'
      }}
      aria-label="Go to homepage"
    >
      <Image
        src="/echostone_logo.png"
        alt="EchoStone Logo"
        width={68}
        height={68}
        style={{
          boxShadow: '0 2px 16px #0003',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)'
        }}
        priority
      />
    </Link>
  )
}