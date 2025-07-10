'use client'

import React, { useState } from "react"
import Image from "next/image"
import Link from "next/link"


const menuItem: React.CSSProperties = {
  display: "block",
  padding: "0.6em 1.2em",
  color: "#e0d4f7",
  textDecoration: "none",
  fontSize: "0.95rem",
  whiteSpace: "nowrap",
  cursor: "pointer",
  background: "transparent",
  border: "none",
  textAlign: "left",
  width: "100%",
}

export default function AccountMenu() {
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
        aria-label="Account menu"
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
          style={{
            position: "absolute",
            right: 0,
            marginTop: 8,
            background: "rgba(30,10,60,0.95)",
            borderRadius: 8,
            boxShadow: "0 4px 24px #0008",
            padding: "0.5em 0",
            zIndex: 50,
          }}
        >
          <Link href="/profile" style={menuItem}>My Profile</Link>
          <Link href="/profile" style={menuItem}>Overview</Link>
          <Link href="/profile/settings" style={menuItem}>Settings</Link>
          <Link href="/profile/billing" style={menuItem}>Billing & Plan</Link>
          <button onClick={() => {/* sign out logic */}} style={menuItem}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}