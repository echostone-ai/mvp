'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { QUESTIONS, Question } from '@/data/questions'
import useEmblaCarousel from 'embla-carousel-react'
import LogoHeader from '@/components/LogoHeader'

export default function EditSectionPage() {
  const params = useParams() as { section: string }
  const section = params.section
  const router = useRouter()
  const questions: Question[] = QUESTIONS[section] || []

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  // No skipSnaps! Just use loop: false for natural UX
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })

  // Set/restore answers
  useEffect(() => {
    const stored = localStorage.getItem(`echostone_profile_${section}`)
    if (stored) {
      setAnswers(JSON.parse(stored))
    } else {
      const initial: Record<string, string> = {}
      questions.forEach(q => { initial[q.key] = '' })
      setAnswers(initial)
    }
  }, [section, questions])
  // Arrow key navigation for Embla
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!emblaApi) return
      if (e.key === 'ArrowRight') {
        emblaApi.scrollNext()
        e.preventDefault()
      }
      if (e.key === 'ArrowLeft') {
        emblaApi.scrollPrev()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [emblaApi])
  // Save & route
  const handleSave = useCallback(() => {
    localStorage.setItem(`echostone_profile_${section}`, JSON.stringify(answers))
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      router.push('/profile')
    }, 800)
  }, [answers, section, router])

  // Answer edit
  const handleChange = (key: string, value: string) => {
    setAnswers(a => ({ ...a, [key]: value }))
    setSaved(false)
  }

  // Slide selection
  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => { emblaApi.off('select', onSelect) }
  }, [emblaApi])

  // Always go to first slide when changing section
  useEffect(() => {
    if (emblaApi) emblaApi.scrollTo(0)
  }, [section, emblaApi])

  const scrollPrev = () => emblaApi?.scrollPrev()
  const scrollNext = () => emblaApi?.scrollNext()

  if (!questions.length) {
    return (
      <main style={{ padding: '2em', color: '#fff' }}>
        <LogoHeader />
        <h2>Section not found</h2>
        <button onClick={() => router.back()}>Go Back</button>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(circle, #8b5cf6 0%, #4c1d95 40%, #000 100%)',
        color: '#f0eaff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
        fontFamily: 'Inter, Arial, sans-serif',
        position: 'relative'
      }}
    >
      <LogoHeader />
      <h1 style={{ margin: '1em 0 0.5em 0', fontSize: '1.8rem', color: '#fff' }}>
        {section.replace(/_/g, ' ')}
      </h1>
      <div
        ref={emblaRef}
        className="embla"
        style={{
          width: '100%',
          maxWidth: 600,
          overflow: 'hidden',
          margin: '2em 0 1em 0',
          borderRadius: 16,
          background: 'rgba(40,20,90,0.85)',
          boxShadow: '0 2px 24px #0006'
        }}
      >
        <div className="embla__container">
          {questions.map((q, idx) => (
            <div className="embla__slide" key={q.key}>
              <div style={{ marginBottom: 24 }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: 13,
                  opacity: 0.65,
                  marginBottom: 8,
                  letterSpacing: 1,
                }}>
                  Question {idx + 1} of {questions.length}
                </span>
                <label style={{
                  display: 'block',
                  fontWeight: 700,
                  marginBottom: 12,
                  fontSize: '1.13rem'
                }}>
                  {q.q}
                </label>
                <textarea
                  value={answers[q.key] || ''}
                  onChange={e => handleChange(q.key, e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 80,
                    borderRadius: 10,
                    padding: '1em',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    background: '#2a1851',
                    color: '#f8f6ff',
                    border: '1px solid #5a3fa8',
                    marginBottom: 4,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 'auto', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={scrollPrev}
                  disabled={selectedIndex === 0}
                  style={{
                    background: '#493093',
                    color: '#fff',
                    padding: '0.65em 1.5em',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '1em',
                    cursor: selectedIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedIndex === 0 ? 0.4 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={scrollNext}
                  disabled={selectedIndex === questions.length - 1}
                  style={{
                    background: '#7c3aed',
                    color: '#fff',
                    padding: '0.65em 1.5em',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '1em',
                    cursor: selectedIndex === questions.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: selectedIndex === questions.length - 1 ? 0.4 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    background: '#20c997',
                    color: '#fff',
                    padding: '0.65em 1.5em',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '1em',
                    marginLeft: 8,
                    cursor: 'pointer',
                    boxShadow: '0 2px 12px #0003',
                    transition: 'background 0.2s'
                  }}
                >
                  {saved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, color: '#fff', opacity: 0.7, fontSize: 15 }}>
        Use ← / → or swipe to move between questions
      </div>
      <style>{`
        .embla { overflow: hidden; }
        .embla__container {
          display: flex;
        }
        .embla__slide {
          flex: 0 0 100%;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 2em 1em;
          display: flex;
          flex-direction: column;
          justify-content: center;
          user-select: text;
        }
        textarea:focus { outline: 2px solid #9d7af2; }
      `}</style>
    </main>
  )
}