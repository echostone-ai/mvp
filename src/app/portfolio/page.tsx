'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface FloatingImage {
  id: number;
  src: string;
  alt: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  baseScale: number;
  blur: number;
  zIndex: number;
  driftAngle: number;
  driftSpeed: number;
}

export default function Portfolio() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [images, setImages] = useState<FloatingImage[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Curated image data with better variety
  const imageData = [
    { src: '/api/placeholder/280/350', alt: 'Portrait Study', width: 280, height: 350 },
    { src: '/api/placeholder/320/240', alt: 'Landscape View', width: 320, height: 240 },
    { src: '/api/placeholder/250/400', alt: 'Abstract Form', width: 250, height: 400 },
    { src: '/api/placeholder/380/280', alt: 'Urban Scene', width: 380, height: 280 },
    { src: '/api/placeholder/300/380', alt: 'Still Life', width: 300, height: 380 },
    { src: '/api/placeholder/350/260', alt: 'Color Study', width: 350, height: 260 },
    { src: '/api/placeholder/260/340', alt: 'Figure Drawing', width: 260, height: 340 },
    { src: '/api/placeholder/340/300', alt: 'Composition', width: 340, height: 300 },
    { src: '/api/placeholder/290/360', alt: 'Mixed Media', width: 290, height: 360 },
    { src: '/api/placeholder/360/280', alt: 'Digital Art', width: 360, height: 280 },
    { src: '/api/placeholder/270/320', alt: 'Sketch Study', width: 270, height: 320 },
    { src: '/api/placeholder/320/290', alt: 'Experimental', width: 320, height: 290 },
    { src: '/api/placeholder/240/380', alt: 'Vertical Study', width: 240, height: 380 },
    { src: '/api/placeholder/400/260', alt: 'Horizontal View', width: 400, height: 260 },
    { src: '/api/placeholder/310/330', alt: 'Square Format', width: 310, height: 330 },
  ];

  // Initialize dimensions
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight * 4 // Extended height for scrolling
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Advanced spacing algorithm - Poisson disk sampling inspired
  const generateOptimalPositions = (imageData: any[], width: number, height: number) => {
    const positions: { x: number; y: number; width: number; height: number; scale: number }[] = [];
    const minDistance = 150; // Minimum distance between images
    const maxAttempts = 50;

    for (let i = 0; i < imageData.length; i++) {
      const img = imageData[i];
      const baseScale = 0.6 + Math.random() * 0.8; // Scale between 0.6 and 1.4
      const scaledWidth = img.width * baseScale;
      const scaledHeight = img.height * baseScale;
      
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < maxAttempts) {
        const x = Math.random() * (width - scaledWidth);
        const y = Math.random() * (height - scaledHeight);
        
        // Check distance from all existing positions
        let validPosition = true;
        for (const pos of positions) {
          const centerX1 = x + scaledWidth / 2;
          const centerY1 = y + scaledHeight / 2;
          const centerX2 = pos.x + pos.width / 2;
          const centerY2 = pos.y + pos.height / 2;
          
          const distance = Math.sqrt(
            Math.pow(centerX1 - centerX2, 2) + Math.pow(centerY1 - centerY2, 2)
          );
          
          const requiredDistance = minDistance + (pos.width + scaledWidth) / 4;
          
          if (distance < requiredDistance) {
            validPosition = false;
            break;
          }
        }
        
        if (validPosition) {
          positions.push({ x, y, width: scaledWidth, height: scaledHeight, scale: baseScale });
          placed = true;
        }
        
        attempts++;
      }
      
      // If we couldn't place it optimally, place it randomly with more space
      if (!placed) {
        const x = Math.random() * (width - scaledWidth);
        const y = Math.random() * (height - scaledHeight);
        positions.push({ x, y, width: scaledWidth, height: scaledHeight, scale: baseScale });
      }
    }
    
    return positions;
  };

  // Initialize floating images with optimal spacing
  useEffect(() => {
    if (dimensions.width === 0) return;

    const positions = generateOptimalPositions(imageData, dimensions.width, dimensions.height);
    
    const initImages = imageData.map((img, index) => {
      const pos = positions[index] || { 
        x: Math.random() * (dimensions.width - img.width), 
        y: Math.random() * (dimensions.height - img.height),
        scale: 0.8
      };
      
      const driftAngle = Math.random() * Math.PI * 2;
      const driftSpeed = 0.1 + Math.random() * 0.3;
      
      return {
        id: index,
        src: img.src,
        alt: img.alt,
        x: pos.x,
        y: pos.y,
        targetX: pos.x,
        targetY: pos.y,
        vx: 0,
        vy: 0,
        width: img.width,
        height: img.height,
        rotation: (Math.random() - 0.5) * 20, // Rotation between -10 and 10 degrees
        rotationSpeed: (Math.random() - 0.5) * 0.05, // Very slow rotation
        scale: pos.scale || 0.8,
        baseScale: pos.scale || 0.8,
        blur: 0,
        zIndex: Math.floor(Math.random() * 100),
        driftAngle,
        driftSpeed,
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

  // Advanced physics animation loop
  useEffect(() => {
    if (images.length === 0) return;

    const animate = () => {
      setImages(prevImages =>
        prevImages.map(img => {
          // Gentle floating movement - very subtle
          const time = Date.now() * 0.001;
          const floatX = Math.cos(time * img.driftSpeed + img.driftAngle) * 0.3;
          const floatY = Math.sin(time * img.driftSpeed + img.driftAngle * 1.3) * 0.2;
          
          // Update target position with gentle float
          const newTargetX = img.targetX + floatX;
          const newTargetY = img.targetY + floatY;
          
          // Very gentle movement towards target
          const easing = 0.01;
          let newVx = (newTargetX - img.x) * easing;
          let newVy = (newTargetY - img.y) * easing;
          
          // Mouse influence - gentle drift when cursor moves
          const imgCenterX = img.x + (img.width * img.scale) / 2;
          const imgCenterY = img.y + (img.height * img.scale) / 2;
          const mouseDistance = Math.sqrt(
            Math.pow(mousePosition.x - imgCenterX, 2) + 
            Math.pow(mousePosition.y - (imgCenterY - scrollY), 2)
          );
          
          // Gentle drift when mouse is nearby
          if (mouseDistance < 300) {
            const influence = (300 - mouseDistance) / 300;
            const angle = Math.atan2(
              mousePosition.y - (imgCenterY - scrollY), 
              mousePosition.x - imgCenterX
            );
            
            // Gentle drift away from cursor
            const driftForce = influence * 0.2;
            newVx += Math.cos(angle + Math.PI) * driftForce; // Drift away
            newVy += Math.sin(angle + Math.PI) * driftForce;
          }
          
          // Apply velocity with strong damping for smooth movement
          const damping = 0.98;
          newVx *= damping;
          newVy *= damping;
          
          // Update position
          const newX = img.x + newVx;
          const newY = img.y + newVy;
          
          // Boundary wrapping (images can go slightly off-screen)
          const margin = 100;
          const wrappedX = newX < -margin ? dimensions.width + margin : 
                          newX > dimensions.width + margin ? -margin : newX;
          const wrappedY = newY < -margin ? dimensions.height + margin : 
                          newY > dimensions.height + margin ? -margin : newY;
          
          // Smooth rotation
          const newRotation = img.rotation + img.rotationSpeed;
          
          // Dynamic scaling - subtle mouse influence only
          const mouseScaleInfluence = mouseDistance < 150 ? 
            (150 - mouseDistance) / 150 * 0.1 : 0;
          const newScale = img.baseScale + mouseScaleInfluence;
          
          // Blur calculation - ONLY based on scroll position
          let scrollBlur = 0;
          
          // Only blur when scrolling down the page
          if (scrollY > 50) {
            const scrollProgress = Math.min(scrollY / 1000, 1); // Max blur at 1000px scroll
            scrollBlur = scrollProgress * 8; // Max 8px blur
          }
          
          const totalBlur = scrollBlur;
          
          // Update z-index based on mouse proximity
          const newZIndex = mouseDistance < 150 ? 1000 + img.id : img.zIndex;
          
          return {
            ...img,
            x: wrappedX,
            y: wrappedY,
            vx: newVx,
            vy: newVy,
            rotation: newRotation,
            scale: newScale,
            blur: totalBlur,
            zIndex: newZIndex,
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
              zIndex: img.zIndex,
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
                <h3>Organic Movement</h3>
                <p>Artworks drift naturally with sophisticated physics</p>
              </div>
              <div className="floating-feature">
                <div className="floating-feature-icon">🌊</div>
                <h3>Smart Spacing</h3>
                <p>Optimal positioning algorithm ensures perfect composition</p>
              </div>
              <div className="floating-feature">
                <div className="floating-feature-icon">✨</div>
                <h3>Layered Depth</h3>
                <p>Multi-dimensional blur and scaling create depth</p>
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