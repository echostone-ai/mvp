# HeyGen Avatar Integration

This integration connects your existing Echostone chat system with HeyGen's real-time avatar streaming, using your profile data and ElevenLabs voice for a complete talking avatar experience.

## What I Built

### 1. HeyGen Integration
- Real-time avatar streaming with WebRTC
- Lip-sync using your ElevenLabs voice
- Your specific avatar ID: 826b9af269ef40d2b54add2f4777e635
- Seamless integration with your existing chat system

### 2. Files Added
- `src/app/avatar-chat/page.tsx` - Main avatar chat page at `/avatar-chat`
- `src/components/AvatarChatInterface.tsx` - Chat interface with HeyGen avatar
- `src/components/HeyGenAvatar.tsx` - HeyGen avatar component
- `src/app/api/heygen/create-session/route.ts` - Creates HeyGen sessions
- `src/app/api/heygen/start-session/route.ts` - Starts avatar streaming
- `src/app/api/heygen/speak/route.ts` - Makes avatar speak with your voice

### 3. Setup Instructions

#### Step 1: Get HeyGen API Key
1. Sign up at [HeyGen](https://www.heygen.com/)
2. Get your API key from the dashboard
3. Add to your `.env.local`:
```bash
HEYGEN_API_KEY=your_heygen_api_key_here
HEYGEN_AVATAR_ID=826b9af269ef40d2b54add2f4777e635
```

#### Step 2: Test the Integration
1. Visit `/avatar-chat`
2. Click "Connect Avatar" 
3. Start chatting with your AI
4. Avatar will speak with your ElevenLabs voice and lip-sync

### 4. Usage Options

#### Option A: Full Avatar Chat Page
Visit `/avatar-chat` for the complete experience.

#### Option B: Embed HeyGen Avatar Anywhere
```tsx
import HeyGenAvatar from '@/components/HeyGenAvatar';

function MyPage() {
  return (
    <div className="w-96 h-96">
      <HeyGenAvatar 
        onConnected={() => console.log('Avatar ready!')}
        onSpeaking={(speaking) => console.log('Speaking:', speaking)}
      />
    </div>
  );
}
```

#### Option C: Full Chat Interface
```tsx
import AvatarChatInterface from '@/components/AvatarChatInterface';

function MyPage() {
  return (
    <AvatarChatInterface 
      profileData={profileData}
      voiceId="CO6pxVrMZfyL61ZIglyr"
    />
  );
}
```

### 5. How It Works

1. **User connects avatar** → Creates HeyGen streaming session
2. **User types message** → Sent to your existing `/api/chat` endpoint  
3. **AI generates response** → Using your profile data and personality
4. **Text → ElevenLabs** → Generates audio with your voice
5. **Audio → HeyGen** → Avatar lip-syncs and speaks
6. **Real-time video** → User sees and hears you talking

### 6. What the AI Knows About You

The chat system uses your `jonathan_profile.json` data:
- **Identity**: Name, location, age, relationships
- **Personality**: Humor style, language patterns, catchphrases  
- **Current Life**: Partner Krissy, dog Romeo, living in Sofia
- **Background**: Travel experiences, memories, hobbies, music
- **Voice**: Your ElevenLabs voice ID for authentic speech
- **Opinions**: Politics, culture, technology, life philosophy

### 7. Technical Details

- **WebRTC Streaming**: Real-time video with low latency
- **Avatar ID**: 826b9af269ef40d2b54add2f4777e635 (your HeyGen avatar)
- **Voice Integration**: ElevenLabs audio sent to HeyGen for lip-sync
- **Session Management**: Automatic connection and cleanup

### 7. Testing It Out

Visit `/avatar-chat` and try these conversations:

**Personal Questions:**
- "Tell me about your partner Krissy"
- "What's your dog Romeo like?"
- "How do you like living in Sofia?"

**Travel & Experiences:**
- "What was Austin like?"
- "Tell me about your travels in Europe"
- "What celebrities have you met?"

**Projects & Opinions:**
- "What is Echostone?"
- "What do you think about AI and the future?"
- "What's your view on politics?"

### 8. Current Status

✅ **Working Now:**
- Chat with your AI personality
- Audio responses with your ElevenLabs voice
- Profile-aware conversations
- Real-time interface

🔄 **Add D-ID API Key For:**
- Live avatar video with lip-sync
- Facial expressions during speech
- Complete audio-visual experience

This gives you the foundation for avatar conversations using your existing Echostone system. When you add the D-ID API key, it will become a full talking avatar experience!