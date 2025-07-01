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

  // Play intro on mount
  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  // Floating particles when mic is active
  useEffect(() => {
    if (!listening) return;
    const newParticles = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: Math.random() * 80 + 10,
      size: Math.random() * 6 + 4,
      delay: Math.random() * 0.5,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, [listening]);

  // Parallax glow motes on mouse move
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const dot = document.createElement("div");
      Object.assign(dot.style, {
        position: "fixed",
        top: `${e.clientY}px`,
        left: `${e.clientX}px`,
        width: "6px",
        height: "6px",
        background: "rgba(255,255,255,0.2)",
        borderRadius: "50%",
        pointerEvents: "none",
        transform: "translate(-50%, -50%)",
        animation: "fadeOutDot 1.5s forwards",
      });
      document.body.append(dot);
      dot.addEventListener("animationend", () => dot.remove());
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

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

    // Play voice response
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

  const micStyle: React.CSSProperties = {
    background: listening ? "#dc2626" : "#444",
    color: "white",
    padding: "0.75rem 2rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transform: listening ? "scale(1.05)" : "scale(1)",
    boxShadow: listening ? "0 0 0 4px rgba(220,38,38,0.5)" : "none",
    transition: "all 0.2s ease",
    fontSize: "1rem",
  };

  return (
    <div>
      <style jsx>{`
        @keyframes fadeOutDot { to { opacity: 0; transform: translate(-50%, -50%) scale(2); } }
        @keyframes floatUp { to { transform: translateY(-80px) scale(0.5); opacity: 0; } }
        @keyframes shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes bar { 0% { height: 5px; } 50% { height: 25px; } 100% { height: 5px; } }
        .sound-graphic { display: flex; gap: 4px; align-items: flex-end; height: 25px; margin-top: 1rem; }
        .sound-graphic div { width: 4px; background: #7e22ce; animation: bar 0.8s infinite ease-in-out; }
      `}</style>
      <main
        style={{
          minHeight: "100vh",
          padding: "2rem",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at center, #8b5cf6 0%, #4c1d95 40%, #000 100%)",
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, rgba(139,92,246,0.2), rgba(76,29,149,0.2), rgba(0,0,0,0.2))",
            backgroundSize: "300% 300%",
            animation: "shift 15s ease infinite",
            pointerEvents: "none",
          }}
        />
        {/* grain overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/grain.svg')",
            opacity: 0.08,
            pointerEvents: "none",
          }}
        />
        {/* floating particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              bottom: "10%",
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: "rgba(255,255,255,0.7)",
              borderRadius: "50%",
              animation: `floatUp 2s ease-out ${p.delay}s forwards`,
              zIndex: 1,
            }}
          />
        ))}
        {/* logo with pulse */}
        <Image
          src="/logo.png"
          alt="EchoStone Logo"
          width={160}
          height={160}
          style={{ marginBottom: "2rem", zIndex: 1, animation: "pulse 3s ease-in-out infinite" }}
        />
        {/* intro banner */}
        <div
          style={{ marginBottom: "1.5rem", fontSize: "1.1rem", color: "#ddd", textAlign
