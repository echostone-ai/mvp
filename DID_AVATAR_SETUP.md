# Smart D-ID Agent Integration

This integration embeds your D-ID conversational agent with full access to your profile data and ElevenLabs voice, creating an authentic AI version of you that anyone can talk to.

## Setup Instructions

### 1. No API Keys Needed!
Your D-ID agent uses the share link you provided, and automatically syncs with your profile data and ElevenLabs voice settings.

### 2. Files Added
- `src/app/agent-demo/page.tsx` - Enhanced demo page at `/agent-demo`
- `src/app/api/profile-context/route.ts` - API endpoint for profile data
- `src/components/SmartDIDAgent.tsx` - Profile-aware agent component
- `src/components/EchostoneAgent.tsx` - Smart chat bubble with profile sync
- `src/components/DIDAgent.tsx` - Basic agent iframe component

### 3. Usage Options

#### Option A: Smart Demo Page (Recommended)
Visit `/agent-demo` to see the full profile-aware agent with status indicators.

#### Option B: Smart Chat Bubble
Add this to any page for a floating chat bubble with profile sync:
```tsx
import EchostoneAgent from '@/components/EchostoneAgent';

function MyPage() {
  return (
    <div>
      {/* Your existing page content */}
      <EchostoneAgent />
    </div>
  );
}
```

#### Option C: Smart Embedded Agent
Embed the profile-aware agent directly:
```tsx
import SmartDIDAgent from '@/components/SmartDIDAgent';

function MyPage() {
  return (
    <div className="w-full h-96">
      <SmartDIDAgent showProfileSync={true} />
    </div>
  );
}
```

#### Option D: Basic Agent (No Profile Sync)
For simple embedding without profile features:
```tsx
import DIDAgent from '@/components/DIDAgent';

function MyPage() {
  return (
    <div className="w-full h-96">
      <DIDAgent />
    </div>
  );
}
```

### 4. How It Works

The smart D-ID agent integration:
1. Loads your profile data from `jonathan_profile.json`
2. Syncs your ElevenLabs voice ID automatically
3. Sends personality context to the D-ID agent
4. User clicks avatar to start voice chat
5. Agent responds as YOU with your voice, personality, and memories
6. Real-time lip-synced avatar video

### 5. What Gets Synced

The agent automatically knows about:
- **Identity**: Your name, nickname, age, location
- **Personality**: Bio, humor style, language patterns, catchphrases  
- **Current Life**: Partner (Krissy), dog (Romeo), living situation
- **Background**: Places lived, recent memories, hobbies, music taste
- **Voice**: Your ElevenLabs voice ID for authentic speech
- **Conversation Style**: Your humor examples, banter patterns, opinions

### 6. Customization

#### Profile Data
The agent pulls from `src/data/jonathan_profile.json`. Update this file to change what the agent knows about you.

#### Voice Settings
Your ElevenLabs voice ID comes from `.env.local`:
```bash
NEXT_PUBLIC_ELEVENLABS_VOICE_ID="CO6pxVrMZfyL61ZIglyr"
```

#### Different Agent
To use a different D-ID agent, update the share URL in the components.

#### Styling
```tsx
<SmartDIDAgent 
  className="custom-styles"
  showProfileSync={true}
/>
```

### 6. Troubleshooting

- **Agent not loading**: Check if the share link is still valid
- **No audio**: Ensure browser allows microphone access
- **Poor performance**: Try refreshing the page or different browser

### 7. Production Notes

- The agent uses your D-ID share link, so it's already configured for public access
- No API keys needed - completely self-contained
- Works across all modern browsers
- Mobile-friendly

The integration is super lightweight and won't disrupt your existing Echostone features. The demo page is at `/agent-demo` and you can drop the chat bubble component anywhere!