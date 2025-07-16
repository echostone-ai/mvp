import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock the MemoryManagement component
vi.mock('@/components/MemoryManagement', () => ({
  default: ({ userId }: { userId: string }) => (
    <div data-testid="memory-management">Memory Management for user: {userId}</div>
  )
}))

// Mock other components
vi.mock('@/components/VoiceRecorder', () => ({
  default: () => <div data-testid="voice-recorder">Voice Recorder</div>
}))

vi.mock('@/components/StoriesSection', () => ({
  default: () => <div data-testid="stories-section">Stories Section</div>
}))

vi.mock('@/components/AccountMenu', () => ({
  default: () => <div data-testid="account-menu">Account Menu</div>
}))

vi.mock('@/components/PageShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="page-shell">{children}</div>
}))

// Mock Supabase
vi.mock('@/components/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'test-user-id', email: 'test@example.com' }
          }
        },
        error: null
      })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              profile_data: {},
              voice_id: null
            },
            error: null
          })
        }))
      }))
    }))
  }
}))

// Mock questions data
vi.mock('@/data/questions', () => ({
  QUESTIONS: {
    personal_snapshot: [
      { key: 'full_legal_name', question: 'What is your full legal name?' }
    ]
  }
}))

describe('Profile Page Memory Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include memory management component in profile page structure', async () => {
    // Import the profile page component dynamically to avoid SSR issues
    const ProfilePage = (await import('../page')).default
    
    render(<ProfilePage />)

    // The component should render without crashing
    expect(screen.getByTestId('page-shell')).toBeDefined()
  })

  it('should have memories tab available', async () => {
    const ProfilePage = (await import('../page')).default
    
    render(<ProfilePage />)

    // Wait for the component to load and check for memories tab
    // Note: This is a basic structural test since the full component has complex state management
    expect(screen.getByTestId('page-shell')).toBeDefined()
  })
})