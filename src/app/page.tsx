'use client'

import React, { useRef, useState } from 'react'
import VideoBackground from '@/components/VideoBackground'
import Image from 'next/image'
import Link from 'next/link'
import styles from './HomePage.module.css'

// SVG icons for feature cards
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

export default function HomePage() {
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
    <div className={styles.fullPageContainer}>
      {/* Header renders Login when logged out; remove inline Login link */}
      
      <main className={styles.landingContainer}>
        {/* Video Background Header */}
        <div className={styles.videoHeader}>
          <VideoBackground videoSrc="/Echostone-front.mp4" />
          <div className={styles.videoContent}>
            <div className={styles.logoContainer}>
              <Image
                src="/echostone_logo.png"
                alt="EchoStone Logo"
                width={160}
                height={160}
                className="logo-pulse"
                draggable={false}
              />
            </div>
            
            <h1 className={styles.heroHeadline}>
              <span className={styles.fadeInText} style={{ animationDelay: '0s' }}>Your voice.</span>{' '}
              <span className={styles.fadeInText} style={{ animationDelay: '0.8s' }}>Your stories.</span>{' '}
              <span className={`${styles.fadeInText} ${styles.eternalGradient}`} style={{ animationDelay: '1.6s' }}>Eternal</span>.
            </h1>
            
            <p className={styles.heroSubheading}>
              Create a living digital legacy. EchoStone transforms your voice, stories, and wisdom into an AI-powered avatar that speaks, remembers, and connects across generations—keeping the essence of who you are alive forever.
            </p>
            
            <div className={styles.ctaButtons}>
              <Link href="/jonathan-demo" className={`${styles.ctaPrimary} ${styles.buttonMaterialize}`} style={{ animationDelay: '2.2s' }}>
                Experience the Magic
              </Link>
              <Link href="/get-started" className={`${styles.ctaSecondary} ${styles.buttonMaterialize}`} style={{ animationDelay: '2.5s' }}>
                Start Your Legacy
              </Link>
            </div>
          </div>
        </div>



        {/* Connection Across Time Section with Video */}
        <div className={styles.connectionSection}>
          <div className={styles.connectionContent}>
            <div className={styles.connectionText}>
              <h3>Connection Across Time</h3>
              <p>
                Picture this: decades from now, your great-grandchildren hear your actual voice sharing the story of how you met their great-grandmother. Not a recording—a conversation. Your avatar answers their questions, shares your dreams, and passes down the family stories that make them who they are.
              </p>
              <p className={styles.hookTagline}>
                This is more than preservation. This is connection across time.
              </p>
            </div>
            <div className={styles.connectionVideo}>
              <div className={styles.videoContainer}>
                <video
                  ref={videoRef}
                  src="/EchoStone.m4v"
                  autoPlay
                  muted={isMuted}
                  controls
                  playsInline
                  className={styles.overviewVideo}
                  poster="/echostone_logo.png"
                >
                  Your browser does not support the video tag.
                </video>
                {isMuted && (
                  <button
                    onClick={handleUnmute}
                    className={styles.videoUnmuteBtn}
                    aria-label="Unmute video"
                  >
                    <span className={styles.unmuteIcon}>🔊</span>
                    <span className={styles.unmuteText}>Tap to Unmute</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid Section */}
        <div className={styles.featuresGrid}>
          <div className={styles.featuresHeader}>
            <h2>Our Technology</h2>
            <p>Cutting-edge AI meets thoughtful design to preserve your most precious memories</p>
          </div>
          
          <div className={styles.gridContainer}>
            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <EmpathyDrivenAIIcon />
              </div>
              <h3>Empathy-Driven AI</h3>
              <p>Our AI listens with care, capturing not just your words but the feelings behind them.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <FutureProofByDesignIcon />
              </div>
              <h3>Future-Proof by Design</h3>
              <p>As AI advances, your story evolves — growing richer with new ways to be shared and remembered.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <PersonalProfileEngineIcon />
              </div>
              <h3>Personal Profile Engine</h3>
              <p>Builds a unique, structured digital snapshot of you through a thoughtful onboarding chat.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <InteractiveStoryCollectorIcon />
              </div>
              <h3>Interactive Story Collector</h3>
              <p>A conversational agent that helps you share meaningful memories and insights naturally.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <ModularMemoryMappingIcon />
              </div>
              <h3>Modular Memory Mapping</h3>
              <p>Stores your story in flexible, evolving data blocks, making updates simple and accurate.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                <DataPrivacyIcon />
              </div>
              <h3>Data Privacy by Design</h3>
              <p>Your personal story stays encrypted and accessible only to you — secure and private.</p>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className={styles.footer}>
        <p>© 2025 EchoStone. All rights reserved.</p>
      </footer>
    </div>
  )
}