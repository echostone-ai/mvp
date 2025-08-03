'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface FloatingImage {
  id: number;
  src: string;
  alt: string;
  x: number;
  y: number;
  vx: number; // velocity x
  vy: number; // velocity y
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  blur: number;
  baseScale: number;
}

export default function Portfolio() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [images, setImages] = useState<FloatingImage[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Your floating images data - replace with your actual images
  const imageData = [
    { src: '/api/placeholder/300/400', alt: 'Artwork 1', width: 300, height: 400 },
    { src: '/api/placeholder/250/350', alt: 'Artwork 2', width: 250, height: 350 },
    { src: '/api/placeholder/350/300', alt: 'Artwork 3', width: 350, height: 300 },
    { src: '/api/placeholder/280/380', alt: 'Artwork 4', width: 280, height: 380 },
    { src: '/api/placeholder/320/250', alt: 'Artwork 5', width: 320, height: 250 },
    { src: '/api/placeholder/290/390', alt: 'Artwork 6', width: 290, height: 390 },
    { src: '/api/placeholder/340/280', alt: 'Artwork 7', width: 340, height: 280 },
    { src: '/api/placeholder/260/360', alt: 'Artwork 8', width: 260, height: 360 },
    { src: '/api/placeholder/310/320', alt: 'Artwork 9', width: 310, height: 320 },
    { src: '/api/placeholder/270/340', alt: 'Artwork 10', width: 270, height: 340 },
    { src: '/api/placeholder/330/290', alt: 'Artwork 11', width: 330, height: 290 },
    { src: '/api/placeholder/240/380', alt: 'Artwork 12', width: 240, height: 380 },
  ];

  // Initialize dimensions
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize floating images with physics properties
  useEffect(() => {
    if (dimensions.width === 0) return;

    const initImages = imageData.map((img, index) => {
      const baseScale = 0.7 + Math.random() * 0.6; // Random scale between 0.7 and 1.3
      return {
        id: index,
        src: img.src,
        alt: img.alt,
        x: Math.random() * (dimensions.width - img.width * baseScale),
        y: Math.random() * (dimensions.height - img.height * baseScale),
        vx: (Math.random() - 0.5) * 0.5, // Random velocity between -0.25 and 0.25
        vy: (Math.random() - 0.5) * 0.5,
        width: img.width,
        height: img.height,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 0.2, // Slow rotation
        scale: baseScale,
        baseScale,
        blur: 0,
      };
    });
    setImages(initImages);
  }, [dimensions]);

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

  // Physics animation loop
  useEffect(() => {
    if (images.length === 0) return;

    const animate = () => {
      setImages(prevImages =>
        prevImages.map(img => {
          // Physics-based movement
          let newX = img.x + img.vx;
          let newY = img.y + img.vy;
          let newVx = img.vx;
          let newVy = img.vy;

          // Boundary collision with soft bounce
          const margin = 50;
          if (newX <= -margin || newX >= dimensions.width - img.width * img.scale + margin) {
            newVx = -newVx * 0.8; // Damping
            newX = Math.max(-margin, Math.min(dimensions.width - img.width * img.scale + margin, newX));
          }
          if (newY <= -margin || newY >= dimensions.height - img.height * img.scale + margin) {
            newVy = -newVy * 0.8; // Damping
            newY = Math.max(-margin, Math.min(dimensions.height - img.height * img.scale + margin, newY));
          }

          // Mouse influence - gentle attraction/repulsion
          const imgCenterX = newX + (img.width * img.scale) / 2;
          const imgCenterY = newY + (img.height * img.scale) / 2;
          const mouseDistance = Math.sqrt(
            Math.pow(mousePosition.x - imgCenterX, 2) + 
            Math.pow(mousePosition.y - imgCenterY, 2)
          );

          // Gentle mouse influence
          if (mouseDistance < 300) {
            const influence = (300 - mouseDistance) / 300;
            const angle = Math.atan2(mousePosition.y - imgCenterY, mousePosition.x - imgCenterX);
            
            // Attraction with some randomness
            const attractionStrength = 0.001 * influence;
            newVx += Math.cos(angle) * attractionStrength;
            newVy += Math.sin(angle) * attractionStrength;
          }

          // Add some random drift
          newVx += (Math.random() - 0.5) * 0.002;
          newVy += (Math.random() - 0.5) * 0.002;

          // Velocity damping to prevent infinite acceleration
          newVx *= 0.999;
          newVy *= 0.999;

          // Limit maximum velocity
          const maxVelocity = 2;
          const currentVelocity = Math.sqrt(newVx * newVx + newVy * newVy);
          if (currentVelocity > maxVelocity) {
            newVx = (newVx / currentVelocity) * maxVelocity;
            newVy = (newVy / currentVelocity) * maxVelocity;
          }

          // Rotation
          const newRotation = img.rotation + img.rotationSpeed;

          // Scale based on mouse proximity
          const scaleInfluence = mouseDistance < 200 ? (200 - mouseDistance) / 200 * 0.2 : 0;
          const newScale = img.baseScale + scaleInfluence;

          // Blur based on scroll position and distance from center
          const viewportCenterY = dimensions.height / 2;
          const distanceFromCenter = Math.abs(imgCenterY - viewportCenterY);
          const maxDistance = dimensions.height / 2;
          const scrollBlur = Math.min((distanceFromCenter / maxDistance) * 6, 6);
          
          // Additional blur based on velocity for motion blur effect
          const velocityBlur = Math.min(currentVelocity * 0.5, 2);
          const totalBlur = scrollBlur + velocityBlur;

          return {
            ...img,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy,
            rotation: newRotation,
            scale: newScale,
            blur: totalBlur,
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
  }, [images.length, mousePosition, dimensions, scrollY]);

  return (
    <div ref={containerRef} className="floating-portfolio">
      {/* Floating Images */}
      <div className="floating-images-container">
        {images.map((img) => (
          <div
            key={img.id}
            className="floating-image"
            style={{
              left: `${img.x}px`,
              top: `${img.y}px`,
              transform: `rotate(${img.rotation}deg) scale(${img.scale})`,
              filter: `blur(${img.blur}px)`,
              width: `${img.width}px`,
              height: `${img.height}px`,
            }}
          >
            <Image
              src={img.src}
              alt={img.alt}
              width={img.width}
              height={img.height}
              className="floating-image-img"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Content Overlay */}
      <div className="floating-content">
        {/* Hero Section */}
        <section className="floating-hero">
          <div className="floating-hero-content">
            <h1 className="floating-hero-title">
              Chuck's
              <span className="floating-hero-accent">Art</span>
            </h1>
            <p className="floating-hero-subtitle">
              Contemporary artworks floating in digital space
            </p>
            <div className="floating-hero-scroll-indicator">
              <div className="scroll-arrow">↓</div>
              <span>Scroll to explore</span>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="floating-about">
          <div className="floating-about-content">
            <h2 className="floating-section-title">About the Artist</h2>
            <div className="floating-about-text">
              <p>
                Chuck's contemporary art explores the intersection of digital and physical spaces, 
                creating immersive experiences that challenge traditional gallery presentations.
              </p>
              <p>
                Each piece floats in its own dimensional space, responding to your presence 
                and creating a unique viewing experience every time you visit.
              </p>
            </div>
          </div>
        </section>

        {/* Gallery Info */}
        <section className="floating-gallery-info">
          <div className="floating-gallery-content">
            <h2 className="floating-section-title">Interactive Gallery</h2>
            <div className="floating-gallery-features">
              <div className="floating-feature">
                <div className="floating-feature-icon">🎨</div>
                <h3>Physics-Based Movement</h3>
                <p>Artworks drift naturally with realistic physics</p>
              </div>
              <div className="floating-feature">
                <div className="floating-feature-icon">🌊</div>
                <h3>Mouse Interaction</h3>
                <p>Images respond gently to your cursor presence</p>
              </div>
              <div className="floating-feature">
                <div className="floating-feature-icon">✨</div>
                <h3>Dynamic Blur</h3>
                <p>Motion and scroll create beautiful blur effects</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="floating-contact">
          <div className="floating-contact-content">
            <h2 className="floating-section-title">Get in Touch</h2>
            <p className="floating-contact-text">
              Interested in commissioning a piece or learning more about the collection?
            </p>
            <div className="floating-contact-actions">
              <button className="floating-contact-btn primary">
                Contact Artist
              </button>
              <button className="floating-contact-btn secondary">
                View Collection
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Background Elements */}
      <div className="floating-background">
        <div className="floating-gradient-orb orb-1"></div>
        <div className="floating-gradient-orb orb-2"></div>
        <div className="floating-gradient-orb orb-3"></div>
      </div>
    </div>
  );
}