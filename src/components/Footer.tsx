import React from 'react'

const Footer: React.FC = () => {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        <div className="footer-brand">
          <img 
            src="/echostone_logo.png" 
            alt="EchoStone" 
            className="footer-logo"
          />
          <span className="footer-brand-text">EchoStone</span>
        </div>
        
        <div className="footer-links">
          <div className="footer-section">
            <h4 className="footer-section-title">Product</h4>
            <ul className="footer-link-list">
              <li><a href="/about" className="footer-link">About</a></li>
              <li><a href="/profile" className="footer-link">Your Profile</a></li>
              <li><a href="/profile/chat" className="footer-link">Chat</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4 className="footer-section-title">Account</h4>
            <ul className="footer-link-list">
              <li><a href="/login" className="footer-link">Sign In</a></li>
              <li><a href="/signup" className="footer-link">Sign Up</a></li>
              <li><a href="/logout" className="footer-link">Sign Out</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4 className="footer-section-title">Support</h4>
            <ul className="footer-link-list">
              <li><a href="mailto:support@echostone.ai" className="footer-link">Contact</a></li>
              <li><a href="/privacy" className="footer-link">Privacy</a></li>
              <li><a href="/terms" className="footer-link">Terms</a></li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p className="footer-copyright">
          © 2024 EchoStone. All rights reserved.
        </p>
        <p className="footer-tagline">
          Your voice, your story, your digital twin.
        </p>
      </div>
    </footer>
  )
}

export default Footer