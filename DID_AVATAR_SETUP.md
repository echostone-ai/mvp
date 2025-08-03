# D-ID Agent Integration Setup

This integration embeds your D-ID conversational agent directly into Echostone, allowing users to interact with your AI avatar without any login required.

## Setup Instructions

### 1. No API Keys Needed!
Your D-ID agent is already configured with the share link you provided. No additional setup required!

### 2. Files Added
- `src/app/agent-demo/page.tsx` - Full demo page at `/agent-demo`
- `src/components/DIDAgent.tsx` - Reusable agent iframe component
- `src/components/EchostoneAgent.tsx` - Drop-in agent with chat bubble UI

### 3. Usage Options

#### Option A: Demo Page
Visit `/agent-demo` to test the full agent integration.

#### Option B: Chat Bubble (Recommended)
Add this to any page for a floating chat bubble:
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

#### Option C: Embedded Agent
Embed the agent directly in your page:
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

#### Option D: Full Page Integration
```tsx
import EchostoneAgent from '@/components/EchostoneAgent';

function AgentPage() {
  return (
    <div className="min-h-screen p-8">
      <h1>Talk to My AI</h1>
      <EchostoneAgent 
        showToggle={false} 
        className="w-full h-96" 
      />
    </div>
  );
}
```

### 4. How It Works

The D-ID agent handles everything:
1. User clicks avatar to start voice chat
2. Speech-to-text happens in D-ID
3. Your configured AI responds
4. Text-to-speech with lip-sync
5. Real-time avatar video

### 5. Customization

#### Different Agent
To use a different D-ID agent, update the component:
```tsx
<DIDAgent 
  agentId="your_agent_id"
  shareKey="your_share_key"
/>
```

#### Styling
Customize the appearance:
```tsx
<EchostoneAgent 
  className="custom-styles"
  showToggle={false}
  defaultOpen={true}
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