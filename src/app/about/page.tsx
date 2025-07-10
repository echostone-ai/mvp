'use client'

import React, { useRef, useState } from 'react'

export default function AboutPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(true)

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false
      videoRef.current.volume = 1
      videoRef.current.play()
      setIsMuted(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3vw 0'
      }}
    >
      <div
        style={{
          width: '100%',
          textAlign: 'center',
          margin: '0 auto',
          padding: '2em 0'
        }}
      >
        <h1 style={{ fontSize: '2.7rem', marginBottom: 8 }}>EchoStone: Immortality Through Voice</h1>
        <p style={{ fontSize: '1.25em', margin: '1.3em 0 2em 0', lineHeight: 1.65 }}>
          EchoStone is an AI-powered platform for digital legacy, memory, and voice.<br/>
          Learn more below.
        </p>
        <div style={{ width: '90vw', maxWidth: 900, margin: '0 auto', position: 'relative' }}>
          <video
            ref={videoRef}
            src="/EchoStone.m4v"
            autoPlay
            muted={isMuted}
            controls
            playsInline
            style={{
              width: '90vw',
              maxWidth: 900,
              borderRadius: 18,
              boxShadow: '0 6px 38px #000a'
            }}
            poster="/echostone_logo.png"
          >
            Your browser does not support the video tag.
          </video>
          {isMuted && (
            <button
              onClick={handleUnmute}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(34,24,56,0.88)',
                color: '#fff',
                border: 'none',
                fontSize: '1.3em',
                borderRadius: 12,
                padding: '0.7em 2.1em',
                cursor: 'pointer',
                boxShadow: '0 4px 18px #6a00ff55'
              }}
            >
              🔊 Tap to Unmute
            </button>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 650px) {
          main > div { max-width: 98vw !important; padding: 1em !important; }
          video { width: 98vw !important; }
        }
      `}</style>
    </main>
  )
}