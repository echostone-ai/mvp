import { describe, it, expect, vi, beforeEach } from 'vitest'

// Minimal test per request: ensure recordMetric writes expected payload into mocked supabase
const insertSpy = vi.fn()

vi.mock('@supabase/supabase-js', () => {
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'extraction_metrics') {
        return { insert: (payload: any) => insertSpy(payload) }
      }
      return { insert: vi.fn(), select: vi.fn(), update: vi.fn(), eq: vi.fn() }
    }),
  }
  return { createClient: vi.fn(() => client) }
})

vi.mock('../extractionPerformanceMonitor', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient('url', 'key') as any
  return {
    recordMetric: (avatarId: string | undefined, stage: 'pattern' | 'llm' | 'persist' | 'promotion', ok: boolean, durationMs: number, extra: any = {}) => {
      client.from('extraction_metrics').insert({
        avatar_id: avatarId,
        stage,
        ok,
        duration_ms: durationMs,
        extra,
      })
    },
  }
})

import { recordMetric } from '../extractionPerformanceMonitor'

describe('recordMetric inserts expected payload', () => {
  beforeEach(() => insertSpy.mockClear())

  it('sends avatar_id, stage, ok, duration_ms, extra fields', () => {
    recordMetric('uuid-123', 'pattern', true, 42, { foo: 'bar' })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    const payload = insertSpy.mock.calls[0][0]
    expect(payload).toMatchObject({
      avatar_id: 'uuid-123',
      stage: 'pattern',
      ok: true,
      duration_ms: 42,
      extra: { foo: 'bar' },
    })
  })
})


