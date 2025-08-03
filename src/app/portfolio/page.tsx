'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface FloatingImage {
  id: number;
  src: string;
  alt: string;
  initialX: number;
  initialY: number;
  currentX: number;
  currentY: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  zIndex: number;
}

export default function Portfolio() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [images, setImages] = useState<FloatingImage[]>([]);
  const animationRef = useRef<number>();

  // Image data - replace with your actual images
  const imageData = [
    { src: '/api/placeholder/300/400', alt: 'Artwork 1', width: 300, height: 400 },
    { src: '/api/placeholder/250/350', alt: 'Artwork 2', width: 250, height: 350 },
    { src: '/api/placeholder/350/280', alt: 'Artwork 3', width: 350, height: 280 },
    { src: '/api/placeholder/280/380', alt: 'Artwork 4', width: 280, height: 380 },
    { src: '/api/placeholder/320/250', alt: 'Artwork 5', width: 320, height: 250 },
    { src: '/api/placeholder/290/360', alt: 'Artwork 6', width: 290, height: 360 },
    { src: '/api/placeholder/340/300', alt: 'Artwork 7', width: 340, height: 300 },
    { src: '/api/placeholder/260/340', alt: 'Artwork 8', width: 260, height: 340 },
    { src: '/api/placeholder/380/280', alt: 'Artwork 9', width: 380, height: 280 },
    { src: '/api/placeholder/270/320', alt: 'Artwork 10', width: 270, height: 320 },
    { src: '/api/placeholder/310/350', alt: 'Artwork 11', width: 310, height: 350 },
    { src: '/api/placeholder/240/300', alt: 'Artwork 12', width: 240, height: 300 },
  ];

  // Initialize images with elegant positioning
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const initImages = imageData.map((img, index) => {
      const scale = 0.4 + Math.random() * 0.5; // Random scale 0.4-0.9
      const x = Math.random() * (window.innerWidth - img.width * scale);
      const y = Math.random() * (window.innerHeight * 3 - img.height * scale);
      
      return {
        id: index,
        src: img.src,
        alt: img.alt,
        initialX: x,
        initialY: y,
        currentX: x,
        currentY: y,
        width: img.width,
        height: img.height,
        rotation: (Math.random() - 0.5) * 30, // -15 to 15 degrees
        scale,
        zIndex: Math.floor(Math.random() * 10),
      };
    });
    
    setImages(initImages);
  }, []);

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth animation loop with stable magnetic attraction
  useEffect(() => {
    if (images.length === 0) return;
    
    const animate = () => {
      setImages(prevImages =>
        prevImages.map(img => {
          // Calculate image center
          const imgCenterX = img.currentX + (img.width * img.scale) / 2;
          const imgCenterY = img.currentY + (img.height * img.scale) / 2;
          
          // Mouse position adjusted for scroll
          const adjustedMouseY = mousePosition.y + scrollY;
          
          // Distance from mouse to image
          const dx = mousePosition.x - imgCenterX;
          const dy = adjustedMouseY - imgCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Calculate target position
          let targetX = img.initialX;
          let targetY = img.initialY;
          
          // Magnetic attraction zone
          const attractionRadius = 300;
          
          if (distance < attractionRadius && distance > 0) {
            // Attraction strength (0 to 1)
            const strength = (attractionRadius - distance) / attractionRadius;
            const smoothStrength = strength * strength; // Smooth curve
            
            // Maximum displacement
            const maxDisplacement = 80;
            
            // Calculate displacement towards mouse
            const displacementX = (dx / distance) * smoothStrength * maxDisplacement;
            const displacementY = (dy / distance) * smoothStrength * maxDisplacement;
            
            targetX = img.initialX + displacementX;
            targetY = img.initialY + displacementY;
          }
          
          // Smooth interpolation to target (lerp)
          const lerpFactor = 0.08; // Smooth movement speed
          const newX = img.currentX + (targetX - img.currentX) * lerpFactor;
          const newY = img.currentY + (targetY - img.currentY) * lerpFactor;
          
          return {
            ...img,
            currentX: newX,
            currentY: newY,
          };
        })
      );
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mousePosition, scrollY, images.length]);

  return (
    <div ref={containerRef} className="chuck-portfolio">
      {/* Fixed positioned floating images */}
      <div className="chuck-images-container">
        {images.map((img) => {
          // Scroll-based blur effect
          const scrollProgress = Math.max(0, scrollY - 50);
          const blur = Math.min(scrollProgress / 500 * 10, 10);
          
          // Opacity based on scroll
          const opacity = Math.max(0.3, 1 - (scrollProgress / 1000));
          
          return (
            <div
              key={img.id}
              className="chuck-image"
              style={{
                position: 'fixed',
                left: `${img.currentX}px`,
                top: `${img.currentY - scrollY * 0.1}px`, // Subtle parallax
                width: `${img.width}px`,
                height: `${img.height}px`,
                transform: `rotate(${img.rotation}deg) scale(${img.scale})`,
                filter: `blur(${blur}px)`,
                opacity: opacity,
                zIndex: img.zIndex,
                pointerEvents: 'none',
                willChange: 'transform, filter, opacity',
              }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                width={img.width}
                height={img.height}
                className="chuck-image-img"
                draggable={false}
                style={{
                  borderRadius: '6px',
                  boxShadow: `0 ${4 + img.scale * 6}px ${12 + img.scale * 8}px rgba(0, 0, 0, 0.3)`,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Content sections with elegant spacing */}
      <div className="chuck-content">
        <section className="chuck-hero">
          <div className="chuck-hero-content">
            <h1 className="chuck-title">
              My
              <span className="chuck-accent">Portfolio</span>
            </h1>
            <p className="chuck-subtitle">
              Creative works floating in digital harmony
            </p>
            <div className="chuck-scroll-hint">
              <div className="scroll-arrow">↓</div>
              <span>Scroll to explore the collection</span>
            </div>
          </div>
        </section>

        <section className="chuck-about">
          <div className="chuck-section-content">
            <h2 className="chuck-section-title">About This Collection</h2>
            <div className="chuck-text">
              <p>
                This portfolio showcases a curated selection of creative works, each piece 
                floating gracefully in its own space, responding to your interaction and 
                creating a unique viewing experience.
              </p>
              <p>
                Move your cursor around to see how the artworks are magnetically drawn 
                to your presence, creating an organic, living gallery that responds to your every movement.
              </p>
            </div>
          </div>
        </section>

        <section className="chuck-gallery">
          <div className="chuck-section-content">
            <h2 className="chuck-section-title">Interactive Experience</h2>
            <div className="chuck-features">
              <div className="chuck-feature">
                <div className="chuck-feature-icon">🎨</div>
                <h3>Mouse Responsive</h3>
                <p>Artworks are magnetically attracted to your cursor with fluid, organic motion</p>
              </div>
              <div className="chuck-feature">
                <div className="chuck-feature-icon">🌊</div>
                <h3>Scroll Blur</h3>
                <p>Images gradually blur as you scroll, creating depth and focus</p>
              </div>
              <div className="chuck-feature">
                <div className="chuck-feature-icon">✨</div>
                <h3>Parallax Motion</h3>
                <p>Layered movement creates an immersive 3D-like experience</p>
              </div>
            </div>
          </div>
        </section>

        <section className="chuck-process">
          <div className="chuck-section-content">
            <h2 className="chuck-section-title">Creative Process</h2>
            <div className="chuck-text">
              <p>
                Each piece in this collection represents a unique exploration of form, 
                color, and digital interaction. The floating presentation allows viewers 
                to experience the work in a non-linear, intuitive way.
              </p>
            </div>
          </div>
        </section>

        <section className="chuck-contact">
          <div className="chuck-section-content">
            <h2 className="chuck-section-title">Get in Touch</h2>
            <p className="chuck-contact-text">
              Interested in collaborating or learning more about these works?
            </p>
            <div className="chuck-contact-actions">
              <button className="chuck-btn primary">Contact Me</button>
              <button className="chuck-btn secondary">View More Work</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}