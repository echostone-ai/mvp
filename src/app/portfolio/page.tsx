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
  targetX: number;
  targetY: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  zIndex: number;
  velocity: { x: number; y: number };
  magneticStrength: number;
  restoreForce: number;
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
    const initImages = imageData.map((img, index) => {
      const scale = 0.5 + Math.random() * 0.6; // Random scale 0.5-1.1
      const x = Math.random() * (window.innerWidth - img.width * scale);
      const y = Math.random() * (window.innerHeight * 5 - img.height * scale);
      
      return {
        id: index,
        src: img.src,
        alt: img.alt,
        initialX: x,
        initialY: y,
        currentX: x,
        currentY: y,
        targetX: x,
        targetY: y,
        width: img.width,
        height: img.height,
        rotation: (Math.random() - 0.5) * 25, // -12.5 to 12.5 degrees
        scale,
        zIndex: Math.floor(Math.random() * 20),
        velocity: { x: 0, y: 0 },
        magneticStrength: 0.3 + Math.random() * 0.4, // 0.3-0.7 attraction strength
        restoreForce: 0.02 + Math.random() * 0.03, // 0.02-0.05 return to origin force
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

  // Smooth animation loop with magnetic attraction
  useEffect(() => {
    const animate = () => {
      setImages(prevImages =>
        prevImages.map(img => {
          // Calculate image center position
          const imgCenterX = img.currentX + (img.width * img.scale) / 2;
          const imgCenterY = img.currentY + (img.height * img.scale) / 2;
          
          // Adjust mouse position for scroll
          const adjustedMouseY = mousePosition.y + scrollY;
          
          // Distance from mouse to image center
          const mouseDistance = Math.sqrt(
            Math.pow(mousePosition.x - imgCenterX, 2) + 
            Math.pow(adjustedMouseY - imgCenterY, 2)
          );

          // Magnetic attraction force - images are drawn TO the mouse
          let attractionX = 0;
          let attractionY = 0;
          
          // Attraction zone - much larger for subtle effect
          const attractionRadius = 400;
          
          if (mouseDistance < attractionRadius && mouseDistance > 0) {
            // Calculate attraction strength (stronger when closer)
            const influence = Math.pow((attractionRadius - mouseDistance) / attractionRadius, 1.5);
            
            // Direction vector from image to mouse (attraction)
            const directionX = (mousePosition.x - imgCenterX) / mouseDistance;
            const directionY = (adjustedMouseY - imgCenterY) / mouseDistance;
            
            // Apply magnetic force
            const magneticForce = influence * img.magneticStrength;
            attractionX = directionX * magneticForce;
            attractionY = directionY * magneticForce;
          }

          // Restore force - gently pulls images back to their original position
          const restoreX = (img.initialX - img.currentX) * img.restoreForce;
          const restoreY = (img.initialY - img.currentY) * img.restoreForce;

          // Combine forces
          const totalForceX = attractionX + restoreX;
          const totalForceY = attractionY + restoreY;

          // Update velocity with forces and damping
          const damping = 0.92;
          const newVelocity = {
            x: (img.velocity.x + totalForceX) * damping,
            y: (img.velocity.y + totalForceY) * damping
          };

          // Update position
          const newX = img.currentX + newVelocity.x;
          const newY = img.currentY + newVelocity.y;

          // Boundary constraints
          const maxX = window.innerWidth - img.width * img.scale;
          const maxY = window.innerHeight * 5 - img.height * img.scale;
          
          const finalX = Math.max(0, Math.min(maxX, newX));
          const finalY = Math.max(0, Math.min(maxY, newY));

          // Soft boundary bounce
          if (newX <= 0 || newX >= maxX) {
            newVelocity.x *= -0.2;
          }
          if (newY <= 0 || newY >= maxY) {
            newVelocity.y *= -0.2;
          }

          return {
            ...img,
            currentX: finalX,
            currentY: finalY,
            velocity: newVelocity,
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
  }, [mousePosition, scrollY]);

  return (
    <div ref={containerRef} className="chuck-portfolio">
      {/* Fixed positioned floating images */}
      <div className="chuck-images-container">
        {images.map((img) => {
          // Calculate distance to mouse for dynamic effects
          const imgCenterX = img.currentX + (img.width * img.scale) / 2;
          const imgCenterY = img.currentY + (img.height * img.scale) / 2;
          const adjustedMouseY = mousePosition.y + scrollY;
          const mouseDistance = Math.sqrt(
            Math.pow(mousePosition.x - imgCenterX, 2) + 
            Math.pow(adjustedMouseY - imgCenterY, 2)
          );
          
          // Progressive blur based on scroll - more elegant curve
          const scrollProgress = Math.max(0, scrollY - 100);
          const blur = Math.min(scrollProgress / 600 * 12, 12);
          
          // Dynamic opacity based on scroll and mouse proximity
          const scrollOpacity = Math.max(0.2, 1 - (scrollProgress / 1200));
          const mouseProximity = mouseDistance < 300 ? 1 : 0.85;
          const finalOpacity = scrollOpacity * mouseProximity;
          
          // Subtle scale effect when near mouse
          const proximityScale = mouseDistance < 200 ? 1 + (200 - mouseDistance) / 200 * 0.1 : 1;
          
          // Dynamic rotation based on velocity
          const velocityRotation = Math.atan2(img.velocity.y, img.velocity.x) * (180 / Math.PI) * 0.1;
          const totalRotation = img.rotation + velocityRotation;
          
          return (
            <div
              key={img.id}
              className="chuck-image"
              style={{
                position: 'fixed',
                left: `${img.currentX}px`,
                top: `${img.currentY - scrollY * 0.2}px`, // Subtle parallax
                width: `${img.width}px`,
                height: `${img.height}px`,
                transform: `rotate(${totalRotation}deg) scale(${img.scale * proximityScale})`,
                filter: `blur(${blur}px) brightness(${0.85 + finalOpacity * 0.15}) saturate(${0.9 + finalOpacity * 0.1})`,
                opacity: finalOpacity,
                zIndex: img.zIndex,
                transition: 'filter 0.4s ease-out',
                pointerEvents: 'none',
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
                  borderRadius: '8px',
                  boxShadow: `0 ${6 + img.scale * 8}px ${15 + img.scale * 12}px rgba(0, 0, 0, ${0.15 + img.scale * 0.1}), 
                             0 ${2 + img.scale * 3}px ${8 + img.scale * 5}px rgba(0, 0, 0, ${0.1 + img.scale * 0.05})`,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
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