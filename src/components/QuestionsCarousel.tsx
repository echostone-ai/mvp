'use client'

import React, { useState, useEffect, useCallback } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import styles from './QuestionsCarousel.module.css'


interface Question {
  key: string
  q: string
}

interface Props {
  questions: Question[]
  initialAnswers?: Record<string, string>
  onComplete?: (answers: Record<string, string>) => void
}

export default function QuestionsCarousel({ questions, initialAnswers = {}, onComplete }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false })
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const q of questions) init[q.key] = initialAnswers[q.key] || ''
    return init
  })
  const [index, setIndex] = useState(0)

  const goNext = useCallback(() => {
    if (emblaApi && index < questions.length - 1) emblaApi.scrollNext()
    else if (index === questions.length - 1 && onComplete) onComplete(answers)
  }, [emblaApi, index, questions.length, answers, onComplete])

  const goPrev = useCallback(() => {
    if (emblaApi && index > 0) emblaApi.scrollPrev()
  }, [emblaApi, index])

  // Listen to Embla's select event to update index
  React.useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', () => setIndex(emblaApi.selectedScrollSnap()))
  }, [emblaApi])

  const handleChange = (key: string, value: string) => {
    setAnswers(a => ({ ...a, [key]: value }))
  }

  return (
    <div className={styles.carouselOuter}>
      <div className={styles.embla} ref={emblaRef}>
        <div className={styles.emblaContainer}>
          {questions.map((q, i) => (
            <div className={styles.emblaSlide} key={q.key}>
              <div className={styles.questionCard}>
                <h2 className={styles.questionTitle}>{q.q}</h2>
                <textarea
                  className={styles.textarea}
                  value={answers[q.key] || ''}
                  onChange={e => handleChange(q.key, e.target.value)}
                  placeholder="Your answer…"
                  rows={5}
                  autoFocus={i === index}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.navButtons}>
        <button
          className={styles.navBtn}
          onClick={goPrev}
          disabled={index === 0}
        >
          ◀ Prev
        </button>
        <button
          className={styles.navBtn}
          onClick={goNext}
          style={{ background: index === questions.length - 1 ? '#00f59e' : '#7c3aed' }}
        >
          {index === questions.length - 1 ? 'Finish' : 'Next ▶'}
        </button>
      </div>
      <div className={styles.progress}>
        {index + 1} / {questions.length}
      </div>
    </div>
  )
}