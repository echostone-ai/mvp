'use client'

import React, { useRef, useState } from 'react'
import PageShell from '@/components/PageShell'

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
    <PageShell>
      <div className="w-full text-center mx-auto py-8">
        <h1 className="text-5xl font-bold mb-2 text-white">
          EchoStone: Immortality Through Voice
        </h1>
        <p className="text-xl my-5 leading-relaxed text-gray-200">
          EchoStone is an AI-powered platform for digital legacy, memory, and voice.<br/>
          Learn more below.
        </p>
        <div className="w-[90vw] max-w-4xl mx-auto relative">
          <video
            ref={videoRef}
            src="/EchoStone.m4v"
            autoPlay
            muted={isMuted}
            controls
            playsInline
            className="w-[90vw] max-w-4xl rounded-2xl shadow-2xl"
            poster="/echostone_logo.png"
          >
            Your browser does not support the video tag.
          </video>
          {isMuted && (
            <button
              onClick={handleUnmute}
              className="video-unmute-btn"
            >
              <span className="unmute-icon">🔊</span>
              <span className="unmute-text">Tap to Unmute</span>
            </button>
          )}
        </div>
      </div>
    </PageShell>
  )
}