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

  // Play intro on first user gesture (click Speak)
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

  return (
    <main style={{
      minHeight: "100vh",
      padding: "2rem",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "#08080a",
      color: "white",
    }}>

      <Image src="/logo.png" alt="EchoStone Logo" width={120} height={120} />
      <h1 style={{ margin: "1rem 0" }}>EchoStone — Ask Jonathan</h1>

      <p style={{ maxWidth: 400, textAlign: "center", marginBottom: "1.5rem", color: "#bbb" }}>
        {INTRO_TEXT}
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything..."
          style={{ flex: 1, padding: "0.75rem", borderRadius: 4, border: "1px solid #333", background: "#121214", color: "white" }}
        />
        <button
          type="submit"
          style={{ padding: "0.75rem 1rem", background: "#7e22ce", border: "none", borderRadius: 4, cursor: "pointer" }}
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      <button
        onClick={startListening}
        style={{
          padding: "0.75rem 1.5rem",
          background: listening ? "#dc2626" : "#444",
          border: "none",
          borderRadius: 4,
          color: "white",
          cursor: "pointer",
        }}
      >
        {listening ? "🎤 Listening…" : "🎤 Speak"}
      </button>

      {answer && (
        <div style={{ marginTop: "2rem", maxWidth: 600, textAlign: "center" }}>
          <h2>Jonathan says:</h2>
          <p style={{ color: "#ddd" }}>{answer}</p>
        </div>
      )}

      <section style={{ marginTop: "3rem", width: "100%", maxWidth: 600 }}>
        <h2 style={{ marginBottom: "1rem" }}>Your 3D Avatar</h2>
        <AvatarCanvas />
      </section>

    </main>
  );
}
