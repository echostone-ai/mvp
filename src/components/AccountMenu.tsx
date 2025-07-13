'use client'

import React, { useState, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/components/supabaseClient"


// Menu CSS styles
export const AccountMenuStyle = (
  <style jsx global>{`
    .account-menu-dropdown {
      animation: fadeInMenu 0.2s;
    }
    @keyframes fadeInMenu {
      from { opacity: 0; transform: translateY(-10px);}
      to   { opacity: 1; transform: none;}
    }
    .account-menu-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .account-menu-item {
      display: block;
      padding: 0.72em 1.3em;
      margin: 0 0 2px 0;
      color: #fff !important;
      background: none;
      text-decoration: none;
      border: none;
      outline: none;
      font-size: 1.09em;
      border-radius: 7px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      transition: background 0.17s, color 0.14s, font-weight 0.14s;
    }
    .account-menu-item:hover,
    .account-menu-item:focus {
      background: #4c2b7a !important;
      color: #fff !important;
      font-weight: 600 !important;
      outline: none;
    }
  `}</style>
)

export default function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const router = useRouter()
  const closeTimeout = useRef<NodeJS.Timeout | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Temporary mock profileData
  const profileData = {
    personal_snapshot: {
      full_legal_name: "Jonathan Ratty"
    }
  }
  const firstName = profileData?.personal_snapshot?.full_legal_name
    ? profileData.personal_snapshot.full_legal_name.split(' ')[0]
    : 'EchoStone'

  const handleMouseEnter = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
    setOpen(true)
  }
  const handleMouseLeave = () => {
    closeTimeout.current = setTimeout(() => {
      setOpen(false)
      closeTimeout.current = null
    }, 900)
  }
  const handleButtonFocus = () => setOpen(true)
  const handleButtonBlur = (e: React.FocusEvent) => {
    if (
      menuRef.current &&
      !menuRef.current.contains(e.relatedTarget as Node)
    ) {
      setOpen(false)
    }
  }
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/login')
  }

  return (
    <>
      {AccountMenuStyle}
      <div
        style={{ display: 'inline-block', position: 'relative' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            outline: "none",
          }}
          aria-label="Account menu"
          tabIndex={0}
          onFocus={handleButtonFocus}
          onBlur={handleButtonBlur}
        >
          {!imgError ? (
            <Image
              src="/user-avatar.png"
              alt="Your avatar"
              width={36}
              height={36}
              style={{ borderRadius: "50%" }}
              onError={() => setImgError(true)}
            />
          ) : (
            <span
              style={{
                display: "inline-block",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#2a1851",
                color: "#fff",
                fontSize: 30,
                textAlign: "center",
                lineHeight: "36px",
              }}
            >👤</span>
          )}
        </button>
        {open && (
          <div
            ref={menuRef}
            className="account-menu-dropdown"
            style={{
              position: "absolute",
              right: 0,
              marginTop: 8,
              background: "rgba(30,10,60,0.95)",
              borderRadius: 16,
              boxShadow: "0 4px 24px #0008",
              padding: "0.7em 0.6em",
              zIndex: 50,
              minWidth: 170,
              userSelect: 'none',
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="account-menu-list">
              <Link href="/"         className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>Home</Link>
              <Link href="/profile/chat"  className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>
                Chat with your avatar
              </Link>
              <Link href="/profile"  className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>Profile</Link>
              <Link href="/about"    className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>About</Link>
              <Link href="/login"    className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>Login</Link>
              <button onClick={handleLogout} className="account-menu-item" tabIndex={0}>
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}