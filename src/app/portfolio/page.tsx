'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function Portfolio() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Placeholder for your images - replace with your actual image data
  const artworks = [
    {
      id: 1,
      title: "Abstract Composition #1",
      category: "abstract",
      image: "/api/placeholder/400/500",
      description: "Mixed media on canvas"
    },
    {
      id: 2,
      title: "Portrait Study",
      category: "portraits",
      image: "/api/placeholder/400/600",
      description: "Oil on canvas"
    },
    {
      id: 3,
      title: "Urban Landscape",
      category: "landscapes",
      image: "/api/placeholder/600/400",
      description: "Acrylic painting"
    },
    {
      id: 4,
      title: "Still Life with Flowers",
      category: "still-life",
      image: "/api/placeholder/400/500",
      description: "Watercolor"
    },
    {
      id: 5,
      title: "Abstract Flow",
      category: "abstract",
      image: "/api/placeholder/500/600",
      description: "Digital art"
    },
    {
      id: 6,
      title: "Mountain Vista",
      category: "landscapes",
      image: "/api/placeholder/600/400",
      description: "Oil painting"
    },
    {
      id: 7,
      title: "Character Study",
      category: "portraits",
      image: "/api/placeholder/400/550",
      description: "Charcoal drawing"
    },
    {
      id: 8,
      title: "Geometric Forms",
      category: "abstract",
      image: "/api/placeholder/500/500",
      description: "Mixed media"
    }
  ];

  const categories = [
    { id: 'all', label: 'All Work' },
    { id: 'abstract', label: 'Abstract' },
    { id: 'portraits', label: 'Portraits' },
    { id: 'landscapes', label: 'Landscapes' },
    { id: 'still-life', label: 'Still Life' }
  ];

  const filteredArtworks = selectedCategory === 'all' 
    ? artworks 
    : artworks.filter(artwork => artwork.category === selectedCategory);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="portfolio-container">
      {/* Hero Section */}
      <section className="portfolio-hero">
        <div className="portfolio-hero-content">
          <div className="portfolio-hero-text">
            <h1 className="portfolio-hero-title">
              Jonathan's
              <span className="portfolio-hero-accent">Art Collection</span>
            </h1>
            <p className="portfolio-hero-subtitle">
              A curated selection of contemporary artworks exploring themes of 
              identity, nature, and human connection through various mediums.
            </p>
            <div className="portfolio-hero-stats">
              <div className="portfolio-stat">
                <span className="portfolio-stat-number">50+</span>
                <span className="portfolio-stat-label">Artworks</span>
              </div>
              <div className="portfolio-stat">
                <span className="portfolio-stat-number">5</span>
                <span className="portfolio-stat-label">Categories</span>
              </div>
              <div className="portfolio-stat">
                <span className="portfolio-stat-number">2024</span>
                <span className="portfolio-stat-label">Latest</span>
              </div>
            </div>
          </div>
          <div className="portfolio-hero-image">
            <div className="portfolio-hero-image-container">
              <Image
                src="/api/placeholder/600/700"
                alt="Featured Artwork"
                width={600}
                height={700}
                className="portfolio-hero-img"
                priority
              />
              <div className="portfolio-hero-image-overlay">
                <div className="portfolio-hero-image-info">
                  <h3>Featured Piece</h3>
                  <p>"Convergence" - Mixed Media, 2024</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Navigation */}
      <section className="portfolio-filters">
        <div className="portfolio-filters-container">
          <h2 className="portfolio-filters-title">Explore by Category</h2>
          <nav className="portfolio-filter-nav">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`portfolio-filter-btn ${
                  selectedCategory === category.id ? 'active' : ''
                }`}
              >
                {category.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="portfolio-gallery">
        <div className="portfolio-gallery-container">
          {isLoading ? (
            <div className="portfolio-loading">
              <div className="portfolio-loading-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="portfolio-loading-card">
                    <div className="portfolio-loading-image" />
                    <div className="portfolio-loading-text">
                      <div className="portfolio-loading-line" />
                      <div className="portfolio-loading-line short" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="portfolio-grid">
              {filteredArtworks.map((artwork, index) => (
                <article 
                  key={artwork.id} 
                  className="portfolio-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="portfolio-card-image-container">
                    <Image
                      src={artwork.image}
                      alt={artwork.title}
                      width={400}
                      height={500}
                      className="portfolio-card-image"
                    />
                    <div className="portfolio-card-overlay">
                      <div className="portfolio-card-actions">
                        <button className="portfolio-card-btn view-btn">
                          <span className="portfolio-card-btn-icon">👁</span>
                          <span>View</span>
                        </button>
                        <button className="portfolio-card-btn info-btn">
                          <span className="portfolio-card-btn-icon">ℹ</span>
                          <span>Info</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="portfolio-card-content">
                    <h3 className="portfolio-card-title">{artwork.title}</h3>
                    <p className="portfolio-card-description">{artwork.description}</p>
                    <div className="portfolio-card-category">
                      {categories.find(cat => cat.id === artwork.category)?.label}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section className="portfolio-about">
        <div className="portfolio-about-container">
          <div className="portfolio-about-content">
            <div className="portfolio-about-text">
              <h2 className="portfolio-about-title">About the Collection</h2>
              <p className="portfolio-about-description">
                This collection represents a journey through various artistic expressions, 
                each piece telling a unique story about the human experience. From abstract 
                explorations of emotion to detailed portraits capturing the essence of 
                character, every artwork is a window into different perspectives and moments.
              </p>
              <p className="portfolio-about-description">
                The works span multiple mediums including oil painting, watercolor, digital art, 
                and mixed media, showcasing the versatility and evolution of artistic vision 
                over time.
              </p>
              <div className="portfolio-about-cta">
                <button className="portfolio-cta-btn">
                  <span>View Full Collection</span>
                  <span className="portfolio-cta-arrow">→</span>
                </button>
              </div>
            </div>
            <div className="portfolio-about-image">
              <Image
                src="/api/placeholder/500/600"
                alt="Artist at work"
                width={500}
                height={600}
                className="portfolio-about-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="portfolio-contact">
        <div className="portfolio-contact-container">
          <div className="portfolio-contact-content">
            <h2 className="portfolio-contact-title">Get in Touch</h2>
            <p className="portfolio-contact-subtitle">
              Interested in commissioning a piece or learning more about the collection?
            </p>
            <div className="portfolio-contact-actions">
              <button className="portfolio-contact-btn primary">
                Commission Artwork
              </button>
              <button className="portfolio-contact-btn secondary">
                View Exhibition
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}