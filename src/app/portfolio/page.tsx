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
  velocity: { x: number; y: number };
  drift: { x: number; y: number };
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
      const scale = 0.6 + Math.random() * 0.5; // Random scale 0.6-1.1
      const x = Math.random() * (window.innerWidth - img.width * scale);
      const y = Math.random() * (window.innerHeight * 4 - img.height * scale);
      
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
        rotation: (Math.random() - 0.5) * 20, // -10 to 10 degrees
        scale,
        zIndex: Math.floor(Math.random() * 15),
        velocity: { x: 0, y: 0 },
        drift: { 
          x: (Math.random() - 0.5) * 0.3, 
          y: (Math.random() - 0.5) * 0.2 
        },
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

  // Smooth animation loop for floating effect
  useEffect(() => {
    const animate = () => {
      setImages(prevImages =>
        prevImages.map(img => {
          // Calculate mouse influence
          const imgCenterX = img.currentX + (img.width * img.scale) / 2;
          const imgCenterY = img.currentY + (img.height * img.scale) / 2;
          
          // Distance from mouse to image center
          const mouseDistance = Math.sqrt(
            Math.pow(mousePosition.x - imgCenterX, 2) + 
            Math.pow(mousePosition.y - (imgCenterY - scrollY), 2)
          );

          // Mouse repulsion force
          let mouseForceX = 0;
          let mouseForceY = 0;
          
          if (mouseDistance < 250) {
            const influence = Math.max(0, (250 - mouseDistance) / 250);
            const angle = Math.atan2(
              (imgCenterY - scrollY) - mousePosition.y,
              imgCenterX - mousePosition.x
            );
            
            const force = influence * 0.8;
            mouseForceX = Math.cos(angle) * force;
            mouseForceY = Math.sin(angle) * force;
          }

          // Apply forces to velocity
          const newVelocity = {
            x: (img.velocity.x + mouseForceX + img.drift.x) * 0.95,
            y: (img.velocity.y + mouseForceY + img.drift.y) * 0.95
          };

          // Update position with velocity
          const newX = img.currentX + newVelocity.x;
          const newY = img.currentY + newVelocity.y;

          // Boundary constraints with gentle bounce
          const maxX = window.innerWidth - img.width * img.scale;
          const maxY = window.innerHeight * 4 - img.height * img.scale;
          
          let finalX = Math.max(0, Math.min(maxX, newX));
          let finalY = Math.max(0, Math.min(maxY, newY));
          
          // Bounce off edges
          if (newX <= 0 || newX >= maxX) {
            newVelocity.x *= -0.3;
          }
          if (newY <= 0 || newY >= maxY) {
            newVelocity.y *= -0.3;
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
          // Progressive blur based on scroll - starts subtle, increases elegantly
          const scrollProgress = Math.max(0, scrollY - 50);
          const blur = Math.min(scrollProgress / 400 * 8, 8);
          const opacity = Math.max(0.3, 1 - (scrollProgress / 1000));
          
          return (
            <div
              key={img.id}
              className="chuck-image"
              style={{
                position: 'fixed',
                left: `${img.currentX}px`,
                top: `${img.currentY - scrollY * 0.3}px`, // Parallax effect
                width: `${img.width}px`,
                height: `${img.height}px`,
                transform: `rotate(${img.rotation}deg) scale(${img.scale})`,
                filter: `blur(${blur}px) brightness(${0.9 + opacity * 0.1})`,
                opacity: opacity,
                zIndex: img.zIndex,
                transition: 'opacity 0.3s ease-out',
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
                  borderRadius: '12px',
                  boxShadow: `0 ${8 + img.scale * 10}px ${20 + img.scale * 15}px rgba(0, 0, 0, ${0.2 + img.scale * 0.1})`,
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
                Move your cursor around to see how the artworks gently drift away, 
                creating an organic, living gallery that changes with every visit.
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
                <p>Artworks elegantly drift away from your cursor with smooth physics</p>
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