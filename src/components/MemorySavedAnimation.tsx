import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

export function MemorySavedAnimation({ text, onComplete }: { text: string, onComplete?: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ 
          opacity: 0, 
          y: 20, // Start from below (inside the input bar)
          scale: 0.8,
          rotateX: -15
        }}
        animate={{ 
          opacity: [0, 1, 1, 0.8, 0], 
          y: [-10, -60, -100, -140, -180], // Leap upward in stages
          scale: [0.8, 1.0, 1.1, 1.2, 1.3],
          rotateX: [-15, 0, 5, 10, 15],
          filter: [
            'drop-shadow(0 0 4px #9b7cff44)',
            'drop-shadow(0 0 12px #9b7cff88)',
            'drop-shadow(0 0 16px #9b7cffaa)',
            'drop-shadow(0 0 20px #9b7cffcc)',
            'drop-shadow(0 0 8px #9b7cff44)'
          ]
        }}
        exit={{ 
          opacity: 0, 
          y: -200, 
          scale: 1.4,
          rotateX: 20
        }}
        transition={{ 
          duration: 2.5, 
          ease: [0.25, 0.46, 0.45, 0.94],
          times: [0, 0.2, 0.5, 0.8, 1] // Control timing of keyframes
        }}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '10px', // Start from the bottom (near input bar)
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 1000,
          fontWeight: 600,
          fontSize: '1rem',
          color: '#fff',
          background: 'linear-gradient(135deg, rgba(155,124,255,0.95) 0%, rgba(124,93,255,0.9) 100%)',
          borderRadius: 16,
          padding: '0.75em 1.5em',
          boxShadow: '0 4px 20px rgba(155,124,255,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          textAlign: 'center',
          letterSpacing: 0.3,
          border: '1px solid rgba(155,124,255,0.3)',
          backdropFilter: 'blur(10px)',
          whiteSpace: 'nowrap',
          maxWidth: '300px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
        onAnimationComplete={onComplete}
      >
        <motion.span 
          style={{ 
            fontWeight: 700, 
            marginRight: 8,
            display: 'inline-block'
          }}
          animate={{ 
            scale: [1, 1.1, 1],
            color: ['#fff', '#f0f0ff', '#fff']
          }}
          transition={{ 
            duration: 0.6, 
            repeat: 2,
            ease: 'easeInOut'
          }}
        >
          🧠 Memory Saved
        </motion.span>
        <motion.span 
          style={{ 
            opacity: 0.9, 
            fontStyle: 'italic',
            fontSize: '0.9em'
          }}
          animate={{
            opacity: [0.9, 1, 0.9]
          }}
          transition={{
            duration: 1,
            repeat: 1,
            ease: 'easeInOut'
          }}
        >
          {text.length > 28 ? text.slice(0, 28) + '…' : text}
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );
} 