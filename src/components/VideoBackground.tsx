'use client'

import { useEffect, useRef } from 'react'
import styles from './VideoBackground.module.css'

interface VideoBackgroundProps {
  videoSrc: string
  className?: string
}

export default function VideoBackground({ videoSrc, className = '' }: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Video is now stationary - no scroll effects needed

  useEffect(() => {
    // Ensure video plays on load
    if (videoRef.current) {
      videoRef.current.play().catch(console.error)
    }
  }, [])

  return (
    <div className={`${styles.videoContainer} ${className}`}>
      <video
        ref={videoRef}
        className={styles.video}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={false}
        onError={(e) => {
          console.error('Video error:', e)
          console.error('Video src:', videoSrc)
        }}
        onLoadStart={() => console.log('Video loading started:', videoSrc)}
        onCanPlay={() => console.log('Video can play:', videoSrc)}
        onLoadedData={() => console.log('Video loaded data:', videoSrc)}
      >
        <source src={videoSrc} type="video/mp4" />
        <p style={{ color: 'white', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          Your browser does not support the video tag.
        </p>
      </video>
      <div className={styles.overlay} />
    </div>
  )
}