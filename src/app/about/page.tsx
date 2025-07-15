'use client'

import React, { useRef, useState } from 'react'
import PageShell from '@/components/PageShell'

// SVG icons for each bullet point

function EmpathyDrivenAIIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <path d="M12 21C12 21 4 14.5 4 8.5C4 5.46 6.46 3 9.5 3C11.24 3 12 4.5 12 4.5C12 4.5 12.76 3 14.5 3C17.54 3 20 5.46 20 8.5C20 14.5 12 21 12 21Z" />
      <path d="M8 9h8" />
      <path d="M8 13h8" />
    </svg>
  )
}

function PersonalProfileEngineIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21c0-4 13-4 13 0" />
      <circle cx="18" cy="15" r="2" />
      <circle cx="6" cy="15" r="2" />
      <line x1="6" y1="17" x2="6" y2="21" />
      <line x1="18" y1="17" x2="18" y2="21" />
    </svg>
  )
}

function InteractiveStoryCollectorIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
      <path d="M8 10h8M8 14h6" />
      <path d="M12 20v-4" />
    </svg>
  )
}

function ModularMemoryMappingIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M10 7h4M10 17h4M7 10v4M17 10v4" />
    </svg>
  )
}

function DataPrivacyIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  )
}

function MultiChannelEngagementIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <path d="M12 1v22" />
      <rect x="3" y="7" width="18" height="10" rx="2" ry="2" />
      <path d="M8 7V3h8v4" />
      <rect x="7" y="14" width="10" height="3" rx="1" ry="1" />
    </svg>
  )
}

function GuidedOnboardingFlowIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 2v6l4 4" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

function FutureProofByDesignIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
    >
      <path d="M32 54c0-12-8-20-20-20" />
      <path d="M32 54c0-12 8-20 20-20" />
      <path d="M32 54V10" />
      <path d="M24 18c2.5-4 8-8 8-8s5.5 4 8 8" />
    </svg>
  )
}

function EvolvingDigitalSelfIcon() {
  return (
    <svg
      className="icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      role="img"
      width="40"
      height="40"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M16 12a4 4 0 0 0-8 0" />
      <path d="M12 8v8" />
      <path d="M12 16l2-2" />
    </svg>
  )
}

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
      <main className="about-page">
        {/* Hero Section */}
        <section className="hero-section text-center py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <a href="/" className="inline-block">
              <img
                src="/echostone_logo.png"
                alt="EchoStone Logo"
                className="logo-pulse w-80 h-80 mx-auto mb-8 select-none cursor-pointer hover:scale-110 transition-transform duration-300"
              />
            </a>

            <h1 className="hero-title text-6xl md:text-7xl font-bold mb-6 text-white leading-tight">
              EchoStone
            </h1>

            <p className="hero-subtitle text-2xl md:text-3xl font-light mb-4 text-purple-200">
              Capture Your Story, Authentically
            </p>

            <p className="hero-description text-lg text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              An AI-powered platform for digital legacy, memory, and voice.
              Preserve your unique story for generations to come.
            </p>
          </div>
        </section>

        {/* Video Section */}
        <section className="video-section py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="video-container relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-sm border border-purple-500/20">
              <video
                ref={videoRef}
                src="/EchoStone.m4v"
                autoPlay
                muted={isMuted}
                controls
                playsInline
                className="w-full aspect-video object-cover rounded-3xl"
                poster="/echostone_logo.png"
              >
                Your browser does not support the video tag.
              </video>
              {isMuted && (
                <button
                  onClick={handleUnmute}
                  className="video-unmute-btn"
                  aria-label="Unmute video"
                >
                  <span className="unmute-icon">🔊</span>
                  <span className="unmute-text">Tap to Unmute</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section py-32 px-4">
          <div className="w-[90vw] mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Our Technology
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Cutting-edge AI meets thoughtful design to preserve your most precious memories
              </p>
            </div>

            <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <EmpathyDrivenAIIcon />
                </div>
                <h3 className="feature-title">Empathy-Driven AI</h3>
                <p className="feature-description">
                  Our AI listens with care, capturing not just your words but the feelings behind them.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <FutureProofByDesignIcon />
                </div>
                <h3 className="feature-title">Future-Proof by Design</h3>
                <p className="feature-description">
                  As AI advances, your story evolves — growing richer with new ways to be shared and remembered.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <PersonalProfileEngineIcon />
                </div>
                <h3 className="feature-title">Personal Profile Engine</h3>
                <p className="feature-description">
                  Builds a unique, structured digital snapshot of you through a thoughtful onboarding chat.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <InteractiveStoryCollectorIcon />
                </div>
                <h3 className="feature-title">Interactive Story Collector</h3>
                <p className="feature-description">
                  A conversational agent that helps you share meaningful memories and insights naturally.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <ModularMemoryMappingIcon />
                </div>
                <h3 className="feature-title">Modular Memory Mapping</h3>
                <p className="feature-description">
                  Stores your story in flexible, evolving data blocks, making updates simple and accurate.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <DataPrivacyIcon />
                </div>
                <h3 className="feature-title">Data Privacy by Design</h3>
                <p className="feature-description">
                  Your personal story stays encrypted and accessible only to you — secure and private.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <MultiChannelEngagementIcon />
                </div>
                <h3 className="feature-title">Multi-Channel Engagement</h3>
                <p className="feature-description">
                  Supports voice and text interactions, making sharing your story easy and natural.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <GuidedOnboardingFlowIcon />
                </div>
                <h3 className="feature-title">Guided Onboarding Flow</h3>
                <p className="feature-description">
                  A clear, intuitive process that feels personal, helping you reveal your story at your pace.
                </p>
              </div>

              <div className="feature-card group">
                <div className="feature-icon-wrapper">
                  <EvolvingDigitalSelfIcon />
                </div>
                <h3 className="feature-title">Evolving Digital Self</h3>
                <p className="feature-description">
                  Your profile grows as you add new stories — a living reflection of your journey.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section py-32 px-4 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to preserve your story?
            </h2>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
              Join thousands who are already capturing their memories with EchoStone's AI-powered platform.
            </p>
            <a
              href="/profile"
              className="cta-button inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              Get Started
            </a>
          </div>
        </section>
      </main>
    </PageShell>
  )
}