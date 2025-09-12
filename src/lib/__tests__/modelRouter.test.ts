import { describe, it, expect } from 'vitest'
import { pickModel } from '@/lib/modelRouter'

describe('modelRouter', () => {
  it('picks gpt-5 when enabled', () => {
    const prev = process.env.FEATURE_GPT5_ENABLED
    const p1 = process.env.MODEL_PRIMARY
    const f1 = process.env.MODEL_FALLBACK
    process.env.FEATURE_GPT5_ENABLED = 'true'
    process.env.MODEL_PRIMARY = 'gpt-5'
    process.env.MODEL_FALLBACK = 'gpt-4o'
    expect(pickModel()).toBe('gpt-5')
    process.env.FEATURE_GPT5_ENABLED = prev
    process.env.MODEL_PRIMARY = p1
    process.env.MODEL_FALLBACK = f1
  })

  it('falls back when disabled', () => {
    const prev = process.env.FEATURE_GPT5_ENABLED
    const p1 = process.env.MODEL_PRIMARY
    const f1 = process.env.MODEL_FALLBACK
    process.env.FEATURE_GPT5_ENABLED = 'false'
    process.env.MODEL_PRIMARY = 'gpt-5'
    process.env.MODEL_FALLBACK = 'gpt-4o'
    expect(pickModel()).toBe('gpt-4o')
    process.env.FEATURE_GPT5_ENABLED = prev
    process.env.MODEL_PRIMARY = p1
    process.env.MODEL_FALLBACK = f1
  })
})



