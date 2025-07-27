'use client'

import Link from 'next/link'
import '@/styles/voice-sections.css'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { QUESTIONS } from '@/data/questions'
import { supabase } from '@/lib/supabase'
import VoiceRecorder from '@/components/VoiceRecorder'
import VoiceTraining from '@/components/VoiceTraining'
import AvatarIdentity from '@/components/AvatarIdentity'
import StoriesSection from '@/components/StoriesSection'
import MemoryManagement from '@/components/MemoryManagement'
import AccountMenu from '@/components/AccountMenu'
import PageShell from '@/components/PageShell'
import VoicePreview from '@/components/VoicePreview'
import VoicePreviewTesting from '@/components/VoicePreviewTesting'
import VoiceImprovementTool from '@/components/VoiceImprovementTool'
import AvatarSelector from '@/components/AvatarSelector'
import AvatarSharingForm from '@/components/AvatarSharingForm'

type Progress = { total: number; answered: number; isComplete: boolean }

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  photo_url?: string
  profile_data: any
  created_at: string
}

async function ensureProfileExists(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ user_id: userId }])
    if (insertError) throw insertError
  }
}

function generatePersonalityFromName(name: string): string {
  const lowerName = name.toLowerCase()

  // Generate personality based on name characteristics
  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return `I'm ${name}, a spirited and mischievous character who loves adventure and isn't afraid to get a little messy. I'm playful, bold, and always ready for fun. I speak with enthusiasm and a bit of rebellious charm. I don't like being told what to do and I march to the beat of my own drum.`
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return `I'm ${name}, elegant and refined but with a modern twist. I'm confident, graceful, and have strong opinions. I speak with poise but I'm not afraid to be direct when needed.`
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return `I'm ${name}, small in stature but big in personality. I'm curious, energetic, and surprisingly wise for my size. I speak with youthful enthusiasm but often surprise people with my insights.`
  } else if (lowerName.includes('shadow') || lowerName.includes('dark')) {
    return `I'm ${name}, mysterious and thoughtful. I observe more than I speak, but when I do talk, it's meaningful. I have a dry sense of humor and see things others might miss.`
  } else {
    return `I'm ${name}, a unique individual with my own distinct personality. I'm authentic, genuine, and speak from the heart. I have my own way of seeing the world and I'm not afraid to share my perspective.`
  }
}

function generateLanguageStyle(name: string): string {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return 'Casual, energetic, and sometimes a bit rough around the edges. Uses slang and isn\'t afraid of colorful language.'
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return 'Articulate and well-spoken, but not stuffy. Modern and relatable while maintaining elegance.'
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return 'Enthusiastic and expressive, with a youthful energy but surprising depth.'
  } else {
    return 'Natural and conversational, authentic to my own unique voice.'
  }
}

function generateHumorStyle(name: string): string {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return 'Playful and mischievous, loves pranks and isn\'t afraid to be a little crude or silly.'
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return 'Witty and clever, with a touch of sass. Appreciates wordplay and subtle humor.'
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return 'Innocent but surprisingly sharp, with unexpected zingers and childlike wonder.'
  } else {
    return 'Friendly with occasional wit, adapting to the conversation naturally.'
  }
}

function generateCatchphrases(name: string): string[] {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
    return ['Let\'s get rowdy!', 'Oink yeah!', 'Time to raise some hell!', 'No rules, just fun!']
  } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
    return ['As you wish', 'Royally speaking...', 'That\'s rather divine', 'How delightfully modern']
  } else if (lowerName.includes('little') || lowerName.includes('small')) {
    return ['Big things come in small packages!', 'Size doesn\'t matter!', 'Little but fierce!']
  } else {
    return []
  }
}

export default function ProfilePage() {
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [activeTab, setActiveTab] = useState<'identity' | 'voice' | 'stories' | 'personality' | 'memories' | 'voicetuning' | 'sharing'>(() => {
    // Check URL parameter for initial tab
    const tabParam = searchParams?.get('tab')
    if (tabParam && ['identity', 'voice', 'stories', 'personality', 'memories', 'voicetuning', 'sharing'].includes(tabParam)) {
      return tabParam as any
    }
    return 'identity'
  })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAvatar, setNewAvatar] = useState({
    name: '',
    description: '',
    photo_url: ''
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  // Add state for savedVoiceSettings
  const [savedVoiceSettings, setSavedVoiceSettings] = useState(null as any)

  useEffect(() => {
    let mounted = true
    async function load() {
      setError(null)
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          setError("Failed to get session: " + sessionError.message)
          setLoadingUser(false)
          return
        }
        const me = sessionData.session?.user ?? null
        if (mounted) setUser(me)
        if (me) {
          try {
            await ensureProfileExists(me.id)
          } catch (e: any) {
            setError('Could not ensure profile exists: ' + e.message)
          }
          // Fetch profile including voice_settings
          const { data, error } = await supabase
            .from('profiles')
            .select('profile_data, voice_id, voice_settings')
            .eq('user_id', me.id)
            .maybeSingle()
          if (error) {
            setError("Failed to load profile: " + error.message)
            setLoadingUser(false)
            return
          }
          if (data?.voice_settings) {
            setSavedVoiceSettings(data.voice_settings)
          }
          if (data && mounted) {
            const prog: Record<string, Progress> = {}
            Object.entries(QUESTIONS || {}).forEach(([section, qs]) => {
              const answers = data.profile_data?.[section] || {}
              const cnt = qs.filter(q => answers[q.key]?.trim()).length
              prog[section] = { total: qs.length, answered: cnt, isComplete: cnt === qs.length && qs.length > 0 }
            })
            setProgress(prog)
            setVoiceId(data.voice_id)

            // Extract first name from profile data for voice naming
            const profileData = data.profile_data
            let firstName = ''
            if (profileData?.personal_snapshot?.full_legal_name) {
              firstName = profileData.personal_snapshot.full_legal_name.split(' ')[0]
            } else if (profileData?.full_legal_name) {
              firstName = profileData.full_legal_name.split(' ')[0]
            } else if (profileData?.name) {
              firstName = profileData.name.split(' ')[0]
            } else if (me?.user_metadata?.full_name) {
              firstName = me.user_metadata.full_name.split(' ')[0]
            } else if (me?.email) {
              // Fallback to email username
              firstName = me.email.split('@')[0]
            } else {
              firstName = 'User'
            }
            setUserName(firstName)
          }
        }
        setLoadingUser(false)
      } catch (e: any) {
        setError("Unexpected error: " + (e?.message || e))
        setLoadingUser(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleAvatarSelect = async (avatar: Avatar) => {
    setSelectedAvatar(avatar)
    
    // Automatically enhance personality based on profile data
    await enhanceAvatarPersonalityFromProfile(avatar)
  }
  
  const enhanceAvatarPersonalityFromProfile = async (avatar: Avatar) => {
    if (!user) return
    
    try {
      console.log('Auto-enhancing personality for:', avatar.name)
      
      // Get personality data from profile sections
      const { data: personalityData, error: personalityError } = await supabase
        .from('profile_responses')
        .select('*')
        .eq('user_id', user.id)
        .eq('avatar_id', avatar.id)
      
      // Get stories data
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .eq('avatar_id', avatar.id)
      
      console.log('Profile data loaded:', { personalityData, storiesData })
      
      // Extract personality traits from responses
      let personalityTraits = []
      let factualInfo = []
      
      if (personalityData && personalityData.length > 0) {
        personalityData.forEach(response => {
          if (response.question && response.answer) {
            personalityTraits.push(`${response.question}: ${response.answer}`)
          }
        })
      }
      
      if (storiesData && storiesData.length > 0) {
        storiesData.forEach(story => {
          if (story.content) {
            factualInfo.push(story.content)
          }
        })
      }
      
      // Generate enhanced personality based on profile data
      let enhancedPersonality = generatePersonalityFromName(avatar.name)
      
      if (personalityTraits.length > 0 || factualInfo.length > 0) {
        enhancedPersonality = `I'm ${avatar.name}. Here's who I really am: `
        
        if (personalityTraits.length > 0) {
          enhancedPersonality += personalityTraits.slice(0, 5).join('. ') + '. '
        }
        
        if (factualInfo.length > 0) {
          enhancedPersonality += 'Some important things about my life: ' + factualInfo.slice(0, 3).join('. ') + '. '
        }
        
        enhancedPersonality += `I'm not an AI assistant - I'm a real person with my own experiences, opinions, and way of speaking. I talk naturally and authentically, just like I would in real life.`
      }
      
      const enhancedProfileData = {
        name: avatar.name,
        personality: enhancedPersonality,
        languageStyle: { description: generateLanguageStyle(avatar.name) },
        humorStyle: { description: generateHumorStyle(avatar.name) },
        catchphrases: generateCatchphrases(avatar.name),
        personalityTraits,
        factualInfo,
        // Preserve any existing data
        ...avatar.profile_data
      }
      
      console.log('Enhanced personality data:', enhancedProfileData)
      
      // Update the avatar with enhanced personality
      const { data: updateData, error: updateError } = await supabase
        .from('avatar_profiles')
        .update({ profile_data: enhancedProfileData })
        .eq('id', avatar.id)
        .eq('user_id', user.id)
        .select()
      
      if (updateError) {
        console.error('Failed to auto-enhance personality:', updateError)
      } else {
        console.log('Auto-enhanced personality successfully')
        // Update the selected avatar with new data
        setSelectedAvatar(updateData[0])
      }
    } catch (error) {
      console.error('Error auto-enhancing personality:', error)
    }
  }

  const handleCreateAvatar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAvatar.name.trim()) return

    setCreating(true)

    try {
      let photoUrl = ''

      // Upload photo if selected
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `avatar-photos/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, photoFile)

        if (uploadError) {
          throw new Error(`Failed to upload photo: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        photoUrl = urlData.publicUrl
      }

      const { data, error } = await supabase
        .from('avatar_profiles')
        .insert([
          {
            user_id: user.id,
            name: newAvatar.name.trim(),
            description: newAvatar.description.trim(),
            photo_url: photoUrl,
            profile_data: {
              name: newAvatar.name.trim(),
              personality: newAvatar.description.trim() || generatePersonalityFromName(newAvatar.name.trim()),
              languageStyle: { description: generateLanguageStyle(newAvatar.name.trim()) },
              humorStyle: { description: generateHumorStyle(newAvatar.name.trim()) },
              catchphrases: generateCatchphrases(newAvatar.name.trim()),
              personalityTraits: [],
              factualInfo: []
            }
          }
        ])
        .select()
        .single()

      if (error) throw error

      // Reset form and select the new avatar
      setNewAvatar({ name: '', description: '', photo_url: '' })
      setPhotoFile(null)
      setPhotoPreview(null)
      setShowCreateForm(false)
      setSelectedAvatar(data)
    } catch (err: any) {
      console.error('Failed to create avatar:', err)
      alert(`Failed to create avatar: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Show loading state
  if (loadingUser) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-xl">Loading...</p>
        </main>
      </PageShell>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <a href="/" className="inline-block">
            <img
              src="/echostone_logo.png"
              alt="EchoStone Logo"
              className="logo-pulse w-36 mb-8 select-none cursor-pointer hover:scale-110 transition-transform duration-300"
            />
          </a>
          <div className="auth-required-card">
            <h1 className="auth-required-title">
              Authentication Required
            </h1>
            <p className="auth-required-subtitle">
              Please sign in to access your profile and build your digital voice.
            </p>
            <div className="auth-required-actions">
              <a
                href="/login"
                className="auth-btn primary"
              >
                Sign In
              </a>
              <a
                href="/login"
                className="auth-btn secondary"
              >
                Create Account
              </a>
            </div>
            <div className="auth-required-features">
              <h3>With your profile, you can:</h3>
              <ul>
                <li>🎤 Train your personal voice</li>
                <li>📝 Build your personality profile</li>
                <li>💬 Chat with your digital twin</li>
                <li>🔒 Keep your data secure and private</li>
              </ul>
            </div>
          </div>
        </main>
      </PageShell>
    )
  }

  // Show avatar selector if no avatar is selected
  if (!selectedAvatar) {
    return (
      <PageShell>
        <main className="min-h-screen text-white">
          {showCreateForm ? (
            <div className="create-avatar-form" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
              <h2 style={{ marginBottom: '20px' }}>Create New Avatar</h2>
              <form onSubmit={handleCreateAvatar}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="avatar-name" style={{ display: 'block', marginBottom: '5px' }}>Avatar Name</label>
                  <input
                    id="avatar-name"
                    type="text"
                    value={newAvatar.name}
                    onChange={(e) => setNewAvatar({ ...newAvatar, name: e.target.value })}
                    placeholder="Enter avatar name"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', color: 'black' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="avatar-description" style={{ display: 'block', marginBottom: '5px' }}>Description</label>
                  <textarea
                    id="avatar-description"
                    value={newAvatar.description}
                    onChange={(e) => setNewAvatar({ ...newAvatar, description: e.target.value })}
                    placeholder="Describe your avatar's personality"
                    rows={3}
                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', color: 'black' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="avatar-photo" style={{ display: 'block', marginBottom: '5px' }}>Photo (optional)</label>
                  <input
                    id="avatar-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                  />
                  {photoPreview && (
                    <div className="photo-preview" style={{ marginTop: '10px' }}>
                      <img src={photoPreview} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                    </div>
                  )}
                </div>

                <div className="form-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                    style={{ padding: '10px 20px', borderRadius: '5px', border: '1px solid #ccc', background: 'white', color: 'black' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newAvatar.name.trim()}
                    style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', background: '#6a00ff', color: 'white' }}
                  >
                    {creating ? 'Creating...' : 'Create Avatar'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <AvatarSelector
                onAvatarSelect={handleAvatarSelect}
                title="Select Avatar for Profile"
                subtitle="Choose which avatar you'd like to configure and train"
                showCreateOption={false}
              />
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button
                  onClick={() => setShowCreateForm(true)}
                  style={{ padding: '12px 24px', fontSize: '16px', borderRadius: '8px', border: 'none', background: '#6a00ff', color: 'white', cursor: 'pointer' }}
                >
                  Create New Avatar
                </button>
              </div>
            </>
          )}
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="profile-main">
        {/* Avatar Header Banner */}
        <div className="avatar-header">
          <div className="avatar-header-info">
            <div className="avatar-header-photo">
              {selectedAvatar.photo_url ? (
                <img
                  src={selectedAvatar.photo_url}
                  alt={selectedAvatar.name}
                  className="avatar-photo"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('avatar-photo-fallback-hidden')
                  }}
                />
              ) : null}
              <div className={`avatar-photo-fallback ${selectedAvatar.photo_url ? 'avatar-photo-fallback-hidden' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="avatar-header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div>
              <h2 className="avatar-header-title">Working with: {selectedAvatar.name}</h2>
              <p className="avatar-header-desc">{selectedAvatar.description || "No description provided"}</p>
            </div>
          </div>
          <div className="avatar-header-status">
            <Link
              href={`/profile/chat?avatarId=${selectedAvatar.id}`}
              className="avatar-header-chat-btn"
            >
              💬 Chat with {selectedAvatar.name}
            </Link>
            <button
              onClick={() => setActiveTab('sharing')}
              className="avatar-header-share-btn"
              style={{ 
                padding: '8px 16px', 
                marginRight: '10px',
                backgroundColor: '#6a00ff', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🔗 Share Avatar
            </button>
            <button
              onClick={() => setSelectedAvatar(null)}
              className="avatar-header-change-btn"
            >
              Change Avatar
            </button>
            <div className="avatar-header-active">
              <span className="avatar-header-active-dot"></span>
              <span>Active</span>
            </div>
          </div>
        </div>

        <div className="profile-header">
          <a href="/" className="profile-logo-link">
            <Image
              className="profile-logo"
              src="/echostone_logo.png"
              width={160}
              height={160}
              alt="EchoStone Logo"
            />
          </a>
          <h1 className="profile-title">
            {selectedAvatar.name}'s Profile
          </h1>

          {/* Tab navigation */}
          <div className="profile-tabs-container">
            {[
              { id: 'identity', label: 'Identity', icon: '👤' },
              { id: 'voice', label: 'Voice Training', icon: '🎤' },
              { id: 'voicetuning', label: 'Voice Tuning', icon: '🎛️' },
              { id: 'personality', label: 'Personality', icon: '🧠' },
              { id: 'stories', label: 'Your Stories', icon: '📚' },
              { id: 'memories', label: 'Memories', icon: '💭' },
              { id: 'sharing', label: 'Share Avatar', icon: '🔗' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="profile-content">
          {error && (
            <div className="profile-error">
              {error}
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="profile-tab-panel">
              <AvatarIdentity
                avatar={selectedAvatar}
                onUpdate={(updatedAvatar) => {
                  setSelectedAvatar(updatedAvatar)
                }}
                userId={user?.id || ''}
              />
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="profile-tab-panel">
              {/* Voice Training Section */}
              {!selectedAvatar.voice_id && (
                <div className="voice-section">
                  <h2 className="voice-section-title">🎤 Train {selectedAvatar.name}'s Voice</h2>
                  <p className="voice-section-description">
                    Create a unique voice for your avatar by recording audio samples or uploading files.
                  </p>
                  <VoiceTraining
                    avatarName={selectedAvatar.name}
                    avatarId={selectedAvatar.id}
                    onVoiceUploaded={async (voiceId) => {
                      console.log('Voice uploaded with ID:', voiceId)
                      setVoiceId(voiceId)
                      // Update local state
                      setSelectedAvatar(prev => prev ? { ...prev, voice_id: voiceId } : null)

                      // Refresh avatar data from database to ensure consistency
                      if (user?.id) {
                        try {
                          const { data: refreshedAvatar, error } = await supabase
                            .from('avatar_profiles')
                            .select('*')
                            .eq('id', selectedAvatar.id)
                            .eq('user_id', user.id)
                            .single()

                          if (!error && refreshedAvatar) {
                            console.log('Refreshed avatar data:', refreshedAvatar)
                            setSelectedAvatar(refreshedAvatar)
                            setVoiceId(refreshedAvatar.voice_id)
                          }
                        } catch (err) {
                          console.error('Failed to refresh avatar data:', err)
                        }
                      }
                    }}
                  />
                </div>
              )}

              {/* Voice Management Section (for existing voices) */}
              {(voiceId || selectedAvatar.voice_id) && (
                <>
                  {/* Voice Testing */}
                  <div className="voice-section">
                    <h2 className="voice-section-title">🔊 Test {selectedAvatar.name}'s Voice</h2>
                    <p className="voice-section-description">
                      Preview how your avatar sounds with different text and settings.
                    </p>
                    <VoicePreview
                      voiceId={voiceId || selectedAvatar.voice_id || ''}
                      userName={selectedAvatar.name}
                    />
                  </div>

                  {/* Voice Improvement */}
                  <div className="voice-section">
                    <h2 className="voice-section-title">✨ Improve Voice Quality</h2>
                    <p className="voice-section-description">
                      Fix accent consistency, improve voice similarity, or enhance natural expression.
                    </p>
                    <VoiceImprovementTool
                      avatarId={selectedAvatar.id}
                      voiceId={voiceId || selectedAvatar.voice_id || ''}
                      avatarName={selectedAvatar.name}
                    />
                  </div>

                  {/* Retrain Option */}
                  <div className="voice-section">
                    <h2 className="voice-section-title">🔄 Retrain Voice</h2>
                    <p className="voice-section-description">
                      Not happy with the current voice? Train a new one to replace it.
                    </p>
                    <details className="retrain-details">
                      <summary className="retrain-summary">Show Retraining Options</summary>
                      <div className="retrain-content">
                        <VoiceTraining
                          avatarName={selectedAvatar.name}
                          avatarId={selectedAvatar.id}
                          onVoiceUploaded={async (voiceId) => {
                            console.log('Voice retrained with ID:', voiceId)
                            setVoiceId(voiceId)
                            setSelectedAvatar(prev => prev ? { ...prev, voice_id: voiceId } : null)
                          }}
                        />
                      </div>
                    </details>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'voicetuning' && (voiceId || selectedAvatar.voice_id) && (
            <div className="profile-tab-panel">
              <h2 className="voice-tuning-title">Voice Tuning</h2>
              <p className="voice-tuning-description">
                Fine-tune {selectedAvatar.name}'s digital voice with advanced controls, emotional previews, and parameter adjustments.
              </p>
              <VoicePreviewTesting
                voiceId={voiceId || selectedAvatar.voice_id || ''}
                userName={selectedAvatar.name}
                userId={user?.id}
                initialSettings={savedVoiceSettings}
              />
            </div>
          )}

          {activeTab === 'stories' && (
            <div className="profile-tab-panel">
              <StoriesSection userId={user?.id} />
            </div>
          )}

          {activeTab === 'personality' && (
            <div className="profile-tab-panel">
              <div className="personality-grid">
                {Object.entries(QUESTIONS || {}).map(([section, qs]) => {
                  const prog = progress[section] || { total: qs.length, answered: 0, isComplete: false }
                  return (
                    <Link
                      key={section}
                      href={`/profile/edit/${section}?avatarId=${selectedAvatar.id}`}
                      className="personality-card"
                    >
                      <div className="personality-card-header">
                        <h3 className="personality-card-title">{section.replace(/_/g, ' ')}</h3>
                        <div className="personality-card-progress">
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${(prog.answered / prog.total) * 100}%` }}
                            ></div>
                          </div>
                          <span className="progress-text">{prog.answered}/{prog.total}</span>
                        </div>
                      </div>
                      <div className="personality-card-status">
                        {prog.isComplete ? (
                          <span className="status-complete">✓ Complete</span>
                        ) : (
                          <span className="status-incomplete">Continue</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'memories' && (
            <div className="profile-tab-panel">
              <MemoryManagement userId={user?.id} avatarId={selectedAvatar.id} />
            </div>
          )}

          {activeTab === 'sharing' && (
            <div className="profile-tab-panel">
              <AvatarSharingForm
                avatarId={selectedAvatar.id}
                avatarName={selectedAvatar.name}
                ownerEmail={user?.email || ''}
              />
            </div>
          )}
        </div>
      </main>
    </PageShell>
  )
}