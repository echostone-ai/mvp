'use client'

import { useEffect } from 'react'
import styles from './Toast.module.css'

type ToastProps = {
  message: string
  durationMs?: number
  onClose?: () => void
}

export default function Toast({ message, durationMs = 2000, onClose }: ToastProps) {
  useEffect(() => {
    if (!onClose) return
    const id = setTimeout(() => onClose(), durationMs)
    return () => clearTimeout(id)
  }, [durationMs, onClose])

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  )
}


