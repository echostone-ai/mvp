'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// CSS is imported in the layout file

interface SharedAvatarNavigationProps {
  shareToken: string;
  userEmail?: string;
  permissions: string[];
}

export default function SharedAvatarNavigation({ shareToken, userEmail, permissions }: SharedAvatarNavigationProps) {
  const pathname = usePathname();
  
  const userEmailParam = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
  
  const navItems = [
    {
      name: 'Chat',
      path: `/shared-avatar/${shareToken}/chat${userEmailParam}`,
      icon: '💬',
      allowed: permissions.includes('chat')
    },
    {
      name: 'Memories',
      path: `/shared-avatar/${shareToken}/memories${userEmailParam}`,
      icon: '🧠',
      allowed: permissions.includes('viewMemories') || permissions.includes('createMemories')
    },
    {
      name: 'Settings',
      path: `/shared-avatar/${shareToken}/settings${userEmailParam}`,
      icon: '⚙️',
      allowed: true
    }
  ];

  return (
    <div className="shared-avatar-navigation">
      <div className="navigation-items">
        {navItems.filter(item => item.allowed).map((item) => (
          <Link
            key={item.name}
            href={item.path}
            className={`navigation-item ${pathname === item.path ? 'active' : ''}`}
          >
            <span className="navigation-icon">{item.icon}</span>
            <span className="navigation-label">{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}