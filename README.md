# EchoStone

EchoStone is a voice AI platform that allows users to create personalized digital avatars with custom voice training and conversational AI capabilities.

## Features

- **Voice AI Avatars**: Create personalized avatars with custom voice training
- **Conversational Onboarding**: Natural conversation-based avatar creation
- **Voice Streaming**: Real-time voice synthesis and playback
- **Avatar Sharing**: Share your avatars with others via secure links
- **Memory System**: Avatars learn and remember from conversations
- **Profile Management**: Manage multiple avatars and voice settings

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (for database and auth)
- ElevenLabs API key (for voice synthesis)
- OpenAI API key (for conversational AI)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/echostone.git
cd echostone
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example environment file
cp .env.example .env.local

# Add your API keys and configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
OPENAI_API_KEY=your_openai_api_key
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Quick Start

1. **Sign Up**: Create an account at `/signup`
2. **Get Started**: Visit `/get-started` to create your first avatar
3. **Voice Training**: Record voice samples or upload audio files
4. **Chat**: Start conversing with your personalized avatar
5. **Share**: Generate shareable links for others to chat with your avatar

## Project Structure

- `/prisma` - Database schema and migrations
- `/src/app` - Next.js app router pages
- `/src/app/api` - API routes
- `/src/components` - React components
- `/src/lib` - Utility functions and services

## API Endpoints

See [LEGACY_HUB_USAGE.md](LEGACY_HUB_USAGE.md) for a complete list of API endpoints.

## License

This project is licensed under the MIT License - see the LICENSE file for details.