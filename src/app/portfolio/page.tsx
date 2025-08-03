'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface FloatingImage {
  id: number;
  src: string;
  alt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  blur: number;
}

export default function Portfolio() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [images, setImages] = useState<FloatingImage[]>([]);

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
  ];

  // Initialize floating images with random positions
  useEffect(() => {
    const initImages = imageData.map((img, index) => ({
      id: index,
      src: img.src,
      alt: img.alt,
      x: Math.random() * (window.innerWidth - img.width),
      y: Math.random() * (window.innerHeight * 3), // Spread across scroll height
      width: img.width,
      height: img.height,
      rotation: Math.random() * 30 - 15, // Random rotation between -15 and 15 degrees
      scale: 0.8 + Math.random() * 0.4, // Random scale between 0.8 and 1.2
      blur: 0,
    }));
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

  // Update image positions and blur based on mouse and scroll
  useEffect(() => {
    setImages(prevImages =>
      prevImages.map(img => {
        // Calculate distance from mouse to image center
        const imgCenterX = img.x + img.width / 2;
        const imgCenterY = img.y + img.height / 2 - scrollY;
        const distanceFromMouse = Math.sqrt(
          Math.pow(mousePosition.x - imgCenterX, 2) + 
          Math.pow(mousePosition.y - imgCenterY, 2)
        );

        // Calculate blur based on distance from viewport center and scroll
        const viewportCenterY = window.innerHeight / 2;
        const distanceFromCenter = Math.abs(imgCenterY - viewportCenterY);
        const maxDistance = window.innerHeight / 2;
        const blurAmount = Math.min((distanceFromCenter / maxDistance) * 8, 8);

        // Mouse attraction effect
        const attraction = 0.02;
        const mouseInfluence = Math.max(0, 200 - distanceFromMouse) / 200;
        const deltaX = (mousePosition.x - imgCenterX) * attraction * mouseInfluence;
        const deltaY = (mousePosition.y - imgCenterY) * attraction * mouseInfluence;

        return {
          ...img,
          x: img.x + deltaX,
          y: img.y + deltaY,
          blur: blurAmount,
          scale: img.scale + mouseInfluence * 0.1, // Slight scale increase near mouse
        };
      })
    );
  }, [mousePosition, scrollY]);

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
                <h3>Mouse Responsive</h3>
                <p>Artworks react to your cursor movement</p>
              </div>
              <div className="floating-feature">
                <div className="floating-feature-icon">🌊</div>
                <h3>Scroll Effects</h3>
                <p>Images blur and focus based on scroll position</p>
              </div>
              <div className="floating-feature">
                <div className="floating-feature-icon">✨</div>
                <h3>Dynamic Layout</h3>
                <p>Every visit creates a unique arrangement</p>
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