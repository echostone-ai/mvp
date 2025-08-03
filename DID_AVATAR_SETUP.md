# Avatar Chat Integration

This integration connects your existing Echostone chat system with avatar visualization, using your profile data and ElevenLabs voice. When you add a D-ID API key, it will show a lip-synced talking avatar.

## What I Built

### 1. Working Now (No API Keys Needed)
- Chat interface using your existing `/api/chat` endpoint
- Responses generated with your profile personality
- Audio playback using your ElevenLabs voice
- Real-time conversation interface

### 2. Files Added
- `src/app/avatar-chat/page.tsx` - Main avatar chat page at `/avatar-chat`
- `src/components/AvatarChatInterface.tsx` - Reusable chat + avatar component
- `src/app/api/profile-context/route.ts` - API endpoint for profile data

### 3. How to Use

#### Option A: Full Avatar Chat Page
Visit `/avatar-chat` to see the complete interface with chat + avatar video area.

#### Option B: Embed the Chat Component
Add the avatar chat interface to any page:
```tsx
import AvatarChatInterface from '@/components/AvatarChatInterface';
import jonathanProfile from '@/data/jonathan_profile.json';

function MyPage() {
  const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr';
  
  return (
    <div className="w-full h-96">
      <AvatarChatInterface 
        profileData={jonathanProfile}
        voiceId={voiceId}
        onMessage={(msg) => console.log('User said:', msg)}
      />
    </div>
  );
}
```

#### Option C: Add to Existing Pages
You can integrate this into your current Echostone pages by importing the component.

### 4. How It Works Right Now

1. **User types message** → Sent to your existing `/api/chat` endpoint
2. **AI generates response** → Using your profile data and personality
3. **Text sent to ElevenLabs** → Generates audio with your voice
4. **Audio plays** → User hears your authentic voice responding
5. **Avatar placeholder** → Shows where video will appear when D-ID is added

### 5. What the AI Knows About You

The chat system uses your `jonathan_profile.json` data:
- **Identity**: Name, location, age, relationships
- **Personality**: Humor style, language patterns, catchphrases  
- **Current Life**: Partner Krissy, dog Romeo, living in Sofia
- **Background**: Travel experiences, memories, hobbies, music
- **Voice**: Your ElevenLabs voice ID for authentic speech
- **Opinions**: Politics, culture, technology, life philosophy

### 6. Adding D-ID Avatar Video

To enable the lip-synced talking avatar:

1. **Get D-ID API Key**: Sign up at [D-ID](https://www.d-id.com/)
2. **Add to .env.local**:
```bash
DID_API_KEY=your_did_api_key_here
```
3. **The system will automatically**:
   - Create D-ID streaming sessions
   - Send your ElevenLabs audio to D-ID
   - Display lip-synced avatar video
   - Sync facial movements with speech

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