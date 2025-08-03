# D-ID Avatar Integration Setup

This integration adds real-time D-ID avatar support to your Echostone app, allowing AI responses to be delivered through a talking avatar with lip-sync.

## Setup Instructions

### 1. Get D-ID API Key
1. Sign up at [D-ID](https://www.d-id.com/)
2. Get your API key from the dashboard
3. Add it to your `.env.local` file (already added for you):
```bash
DID_API_KEY=your_actual_did_api_key_here
```
Replace `your_did_api_key_here` with your actual D-ID API key.

### 2. Files Added
- `src/app/api/did-stream/route.ts` - Creates D-ID streaming sessions
- `src/app/api/did-stream/send-audio/route.ts` - Sends audio to avatar
- `src/app/api/did-stream/answer/route.ts` - Handles WebRTC handshake
- `src/app/avatar-demo/page.tsx` - Demo page at `/avatar-demo`
- `src/components/DIDAvatar.tsx` - Reusable avatar component
- `src/lib/useDIDAvatar.ts` - React hook for easy integration

### 3. Usage Options

#### Option A: Demo Page
Visit `/avatar-demo` to test the integration with a full UI.

#### Option B: Drop-in Component
```tsx
import DIDAvatar from '@/components/DIDAvatar';

function MyPage() {
  return (
    <div className="w-96 h-96">
      <DIDAvatar 
        voiceId="your_elevenlabs_voice_id"
        onConnected={() => console.log('Avatar connected!')}
      />
    </div>
  );
}
```

#### Option C: React Hook (Most Flexible)
```tsx
import { useDIDAvatar } from '@/lib/useDIDAvatar';

function MyComponent() {
  const { videoRef, isConnected, connect, speak, disconnect } = useDIDAvatar({
    voiceId: 'your_elevenlabs_voice_id',
    onConnected: () => console.log('Connected!'),
  });

  const handleSpeak = () => {
    speak('Hello from my avatar!');
  };

  return (
    <div>
      <video ref={videoRef} className="w-full h-full" />
      {!isConnected ? (
        <button onClick={connect}>Connect Avatar</button>
      ) : (
        <button onClick={handleSpeak}>Make Avatar Speak</button>
      )}
    </div>
  );
}
```

### 4. Integration with Existing Voice Flow

To integrate with your existing Echostone voice generation:

```tsx
// In your existing component where you handle AI responses
const handleAIResponse = async (aiText: string) => {
  // Your existing logic...
  
  // Add avatar speech
  if (window.didAvatar?.isConnected) {
    await window.didAvatar.speak(aiText);
  }
};
```

### 5. Pipeline Flow
1. User speaks → Speech-to-text
2. AI generates response text
3. Text → ElevenLabs → Audio
4. Audio → D-ID → Lip-synced avatar video
5. Video streams to frontend via WebRTC

### 6. Customization

#### Custom Avatar
Replace the default avatar by providing your own image URL:
```tsx
<DIDAvatar avatarId="https://your-image-url.com/avatar.jpg" />
```

#### Voice Settings
Use any ElevenLabs voice ID:
```tsx
<DIDAvatar voiceId="your_custom_voice_id" />
```

### 7. Troubleshooting

- **No video**: Check browser console for WebRTC errors
- **No audio**: Ensure browser allows autoplay
- **Connection fails**: Verify D-ID API key is correct
- **Poor quality**: Try different avatar images (high-res, front-facing works best)

### 8. Production Notes

- D-ID has usage limits and costs per minute
- Consider adding connection pooling for multiple users
- WebRTC works best over HTTPS in production
- Test across different browsers and devices

The integration is lightweight and won't disrupt your existing Echostone features. The demo page is completely separate at `/avatar-demo`.