'use client';

import React, { useRef, useEffect } from 'react';

const PARTICLE_COUNT = 60;
const COLORS = ['#fff6e0', '#b3cfff', '#ffe6fa', '#ffe6b3', '#c0ffe6', '#e0e6ff'];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

interface Particle {
  x: number;
  y: number;
  r: number;
  baseR: number;
  opacity: number;
  baseOpacity: number;
  vx: number;
  vy: number;
  color: string;
  pulse: number;
  pulseSpeed: number;
}

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Generate particles
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = randomBetween(1.5, 4.5);
      const opacity = randomBetween(0.15, 0.5);
      particles.push({
        x: randomBetween(0, width),
        y: randomBetween(0, height),
        r,
        baseR: r,
        opacity,
        baseOpacity: opacity,
        vx: randomBetween(-0.03, 0.03),
        vy: randomBetween(-0.015, 0.015),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: randomBetween(0.001, 0.003),
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        // Animate position
        p.x += p.vx;
        p.y += p.vy;
        // Wrap around edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Animate pulsing
        p.pulse += p.pulseSpeed;
        const pulse = (Math.sin(p.pulse) + 1) / 2; // 0..1
        const r = p.baseR + pulse * 1.2;
        const opacity = p.baseOpacity + pulse * 0.15;

        // Draw glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,200,255,${opacity * 0.12})`;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.restore();

        // Draw core
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }
      animationRef.current = requestAnimationFrame(draw);
    }

    draw();

    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current!);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        background: '#0b0f1a',
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
};

export default ParticleBackground; 