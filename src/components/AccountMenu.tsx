'use client'

import React, { useState, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/components/supabaseClient"

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
    <div
      className="inline-block relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="border-none bg-transparent cursor-pointer p-0 outline-none"
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
            className="rounded-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="inline-block w-9 h-9 rounded-full bg-purple-900 text-white text-3xl text-center leading-9">
            👤
          </span>
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          className="account-menu-dropdown absolute right-0 mt-2 bg-purple-900/95 rounded-2xl shadow-2xl p-3 z-50 min-w-44 select-none animate-fade-in"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="account-menu-list flex flex-col gap-1">
            <Link href="/" className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>
              Home
            </Link>
            <Link href="/profile/chat" className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>
              Chat with your avatar
            </Link>
            <Link href="/profile" className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>
              Profile
            </Link>
            <Link href="/about" className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>
              About
            </Link>
            <Link href="/login" className="account-menu-item" tabIndex={0} onClick={() => setOpen(false)}>
              Login
            </Link>
            <button onClick={handleLogout} className="account-menu-item" tabIndex={0}>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}