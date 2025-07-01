.page-container {
  min-height: 100vh;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: radial-gradient(circle at center, #8b5cf6 0%, #4c1d95 40%, #000 100%);
  color: white;
  position: relative;
  overflow: hidden;
}

/* Gradient & grain overlays */
.page-container::before,
.page-container::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.page-container::before {
  background: linear-gradient(120deg,
    rgba(139,92,246,0.2),
    rgba(76,29,149,0.2),
    rgba(0,0,0,0.2)
  );
  background-size: 300% 300%;
  animation: shift 15s ease infinite;
  z-index: 0;
}
.page-container::after {
  background-image: url("/grain.svg");
  opacity: 0.08;
  z-index: 1;
}

/* Intro banner */
.intro-banner {
  margin: 1rem 0 2rem;
  color: #ddd;
  text-align: center;
  max-width: 400px;
}

/* Form */
.ask-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.ask-form input {
  flex: 1;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #333;
  background: #121214;
  color: white;
}
.ask-form button {
  padding: 0.75rem 1rem;
  background: #7e22ce;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* Answer box */
.answer-box {
  margin-top: 2rem;
  text-align: center;
}
.answer-box p {
  color: #ddd;
}

/* Avatar section */
.avatar-section {
  margin-top: 3rem;
  width: 100%;
  max-width: 600px;
}

/* Sound graphic bars */
.sound-graphic {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 25px;
  margin-top: 1rem;
}
.sound-graphic div {
  width: 4px;
  background: #7e22ce;
  animation: bar 0.8s infinite ease-in-out;
}

/* Particles */
.particle {
  position: absolute;
  bottom: 10%;
  background: rgba(255,255,255,0.7);
  border-radius: 50%;
  animation: floatUp 2s ease-out forwards;
}

/* Glow motes */
.glow-dot {
  position: fixed;
  width: 6px;
  height: 6px;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: fadeOutDot 1.5s forwards;
}

/* Animations */
@keyframes shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes pulse {
  0%,100% { transform: scale(1); }
  50%    { transform: scale(1.05); }
}
@keyframes bar {
  0%   { height: 5px; }
  50%  { height: 25px; }
  100% { height: 5px; }
}
@keyframes floatUp {
  to { transform: translateY(-80px) scale(0.5); opacity: 0; }
}
@keyframes fadeOutDot {
  to { opacity: 0; transform: translate(-50%, -50%) scale(2); }
}
