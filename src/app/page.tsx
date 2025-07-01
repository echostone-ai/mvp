/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import AvatarCanvas from "@/components/AvatarCanvas";

// Intro text constant
const INTRO_TEXT = "👋 Hi there! I'm EchoStone — ask me anything or click 🎤 to speak!";

type Particle = { id: number; left: number; size: number; delay: number };

export default function Page() {
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const recognitionRef = useRef<any>(null);
  const introPlayed = useRef<boolean>(false);

  const playIntro = async () => {
    if (introPlayed.current) return;
    introPlayed.current = true;
    setPlaying(true);
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: INTRO_TEXT }),
      });
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setPlaying(false);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const { answer } = await chatRes.json();
      setAnswer(answer);
    } catch {
      setAnswer("Sorry, something went wrong.");
    }
    setLoading(false);
    try {
      const voiceRes = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer }),
      });
      const blob = await voiceRes.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      setPlaying(true);
      audio.onended = () => setPlaying(false);
      audio.play();
    } catch {
      setPlaying(false);
    }
  };

  const startListening = () => {
    playIntro();
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const Recognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    setListening(true);
    recognition.start();
    recognition.onresult = (evt: any) => {
      setQuestion(evt.results[0][0].transcript);
      handleSubmit();
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
  };

  useEffect(() => {
    if (!listening) return;
    const newParticles = Array.from({ length: 15 }).map((_, i) => ({ id: i, left: Math.random()*80+10, size: Math.random()*6+4, delay: Math.random()*0.5 }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, [listening]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const dot = document.createElement('div');
      dot.className = 'glow-dot';
      dot.style.top = `${e.clientY}px`;
      dot.style.left = `${e.clientX}px`;
      document.body.append(dot);
      dot.addEventListener('animationend', () => dot.remove());
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  return (
    <main className="page-container">
      <Image src="/logo.png" alt="EchoStone Logo" width={120} height={120} />
      <h1>EchoStone — Ask Jonathan</h1>
      <p className="intro-banner">{INTRO_TEXT}</p>
      <form onSubmit={handleSubmit} className="ask-form">
        <input type="text" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask anything…" />
        <button type="submit">{loading? 'Thinking…':'Ask'}</button>
      </form>
      <button onClick={startListening} className={listening? 'mic-button listening':'mic-button'}>
        {listening? '🎤 Listening…':'🎤 Speak'}
      </button>
      {answer && <div className="answer-box"><h2>Jonathan says:</h2><p>{answer}</p></div>}
      <section className="avatar-section"><h2>Your 3D Avatar</h2><AvatarCanvas/></section>
      {playing && <div className="sound-graphic">{[...Array(5)].map((_,i)=><div key={i} style={{animationDelay:`${i*0.1}s`}}/> )}</div>}
      {particles.map(p=><div key={p.id} className="particle" style={{left:`${p.left}%`,width:`${p.size}px`,height:`${p.size}px`,animationDelay:`${p.delay}s`}}/>)}
    </main>
  );
}
