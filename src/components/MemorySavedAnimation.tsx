import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

export function MemorySavedAnimation({ text, onComplete }: { text: string, onComplete?: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 0, scale: 0.9 }}
        animate={{ opacity: 1, y: -40, scale: 1.1, filter: 'drop-shadow(0 0 8px #9b7cff88)' }}
        exit={{ opacity: 0, y: -80, scale: 1.2 }}
        transition={{ duration: 1.2, ease: [0.4, 0.0, 0.2, 1] }}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 100,
          fontWeight: 600,
          fontSize: '1.1rem',
          color: '#fff',
          background: 'rgba(155,124,255,0.85)',
          borderRadius: 12,
          padding: '0.5em 1.2em',
          boxShadow: '0 2px 16px #9b7cff44',
          textAlign: 'center',
          letterSpacing: 0.2,
        }}
        onAnimationComplete={onComplete}
      >
        <span style={{ fontWeight: 700, marginRight: 8 }}>Memory Saved</span>
        <span style={{ opacity: 0.8, fontStyle: 'italic' }}>
          {text.length > 32 ? text.slice(0, 32) + '…' : text}
        </span>
      </motion.div>
    </AnimatePresence>
  );
} 