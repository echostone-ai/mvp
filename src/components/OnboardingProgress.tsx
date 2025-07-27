'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface OnboardingSession {
  id: string;
  avatar_id: string | null;
  current_question: number;
  total_questions: number;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  avatar_name?: string;
}

export default function OnboardingProgress() {
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadIncompleteSessions() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const user = session.session?.user;
        
        if (!user) {
          setLoading(false);
          return;
        }

        // Get incomplete onboarding sessions
        const { data: sessionData, error } = await supabase
          .from('onboarding_sessions')
          .select(`
            *,
            avatar_profiles!left(name)
          `)
          .eq('user_id', user.id)
          .eq('is_complete', false)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const sessionsWithNames = sessionData?.map(session => ({
          ...session,
          avatar_name: session.avatar_profiles?.name || 'New Avatar'
        })) || [];

        setSessions(sessionsWithNames);
      } catch (error) {
        console.error('Error loading incomplete sessions:', error);
      } finally {
        setLoading(false);
      }
    }

    loadIncompleteSessions();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <div className="processing-spinner" style={{ margin: '0 auto' }}></div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div style={{ 
      background: 'rgba(245, 158, 11, 0.1)', 
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '12px',
      padding: '1.5rem',
      margin: '1rem 0'
    }}>
      <h3 style={{ 
        color: 'var(--warning-color)', 
        margin: '0 0 1rem 0',
        fontSize: '1.2rem',
        fontWeight: '600'
      }}>
        📝 Resume Voice Onboarding
      </h3>
      
      <p style={{ 
        color: 'var(--text-muted)', 
        margin: '0 0 1.5rem 0',
        lineHeight: '1.5'
      }}>
        You have incomplete voice onboarding sessions. Continue where you left off:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sessions.map((session) => (
          <div key={session.id} style={{
            background: 'rgba(20, 15, 40, 0.6)',
            border: '1px solid rgba(147, 71, 255, 0.2)',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ 
                color: 'var(--text-primary)', 
                fontWeight: '600',
                marginBottom: '0.25rem'
              }}>
                {session.avatar_name}
              </div>
              <div style={{ 
                color: 'var(--text-muted)', 
                fontSize: '0.9rem'
              }}>
                Progress: {session.current_question} of {session.total_questions} questions completed
              </div>
              <div style={{
                width: '200px',
                height: '4px',
                background: 'rgba(147, 71, 255, 0.2)',
                borderRadius: '2px',
                marginTop: '0.5rem',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(session.current_question / session.total_questions) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--primary-color), var(--primary-light))',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>
            
            <Link
              href={`/get-started?session=${session.id}`}
              style={{
                background: 'linear-gradient(135deg, var(--warning-color), #f59e0b)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Continue →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}