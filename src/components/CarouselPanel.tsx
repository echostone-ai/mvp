// src/components/CarouselPanel.tsx
import React from "react"

interface CarouselPanelProps {
  width: number
  active: boolean
  children: React.ReactNode
}

export default function CarouselPanel({ width, active, children }: CarouselPanelProps) {
  return (
    <div
      style={{
        flex: `0 0 ${width}px`,
        margin: "0 16px",
        padding: active ? "2.4em 1.6em" : "2.2em 1.6em",
        borderRadius: 24,
        background: active ? "rgba(30,10,60,0.96)" : "rgba(30,10,60,0.5)",
        boxShadow: active ? "0 12px 48px #6a00ff4d" : "0 2px 16px #0006",
        filter: active ? "none" : "blur(2px) brightness(0.7)",
        opacity: active ? 1 : 0.6,
        transform: active ? "scale(1)" : "scale(0.9)",
        transition: "all 0.6s cubic-bezier(.25,.8,.25,1)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {children}
    </div>
  )
}