'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Avatars', path: '/avatars' },
    { name: 'Shared Avatars', path: '/shared-avatars' },
    { name: 'Hubs', path: '/hubs' },
    { name: 'Profile', path: '/profile' }
  ];

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <Link href="/" className="nav-logo">
          <img src="/echostone_logo.png" alt="EchoStone" width={32} height={32} />
          <span>EchoStone</span>
        </Link>
        
        <div className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.path}
              className={`nav-link ${pathname === item.path ? 'active' : ''}`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}