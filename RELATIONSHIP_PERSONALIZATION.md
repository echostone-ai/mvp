# Relationship Personalization System

## Overview

The EchoStone jonathan-demo avatar now includes a sophisticated relationship personalization system that detects known people from the factbook and provides intimate, personalized responses with nicknames and specific details.

## Key Features

### 🎯 **Automatic Relationship Detection**
- Detects family members, friends, partners, and ex-partners
- Recognizes self-identification patterns ("It's your brother!", "Tyler here")
- Uses contextual clues (relationship terms, names, nicknames)

### 💝 **Personalized Greetings**
- Uses nicknames when available (Geoff → "Boris", Tyler → "T")
- Generates context-appropriate greetings
- Asks specific personal questions based on relationship

### 🏠 **Intimacy Levels**
- **Partner**: Very intimate, loving, playful
- **Family**: Warm, loving, references shared memories
- **Friend**: Casual, warm, references shared experiences
- **Acquaintance**: Friendly but respectful
- **Stranger**: Normal conversational tone

## Known People Database

### Family Members
- **Geoff Braden** (nickname: "Boris") - Older brother
  - Personal details: Farm childhood, has children (nephews)
  - Questions: "How are my nephews?", "Remember our farm days?"

- **Eric Braden** (nickname: "Dad") - Father
  - Personal details: Retired to France, has dogs Gus and Una
  - Questions: "How's retirement in Verteillac?", "How's Mom?"

- **Mary Braden** (nickname: "Mom") - Mother
  - Personal details: Retired to France, wonderful childhood provider
  - Questions: "How's Dad doing?", "How are your gardens?"

### Partner
- **Krissy** (nickname: "babe") - Current partner
  - Personal details: Law student, yoga/pilates, speaks multiple languages
  - Questions: "How are your law studies?", "Ready for some yoga?"

### Close Friends
- **Tyler McCoy** (nickname: "T") - Austin friend
  - Personal details: Yoga instructor, tech enthusiast, partner Cansu
  - Questions: "How's Cansu?", "Still teaching yoga?"

- **Eric** (nickname: "E") - NYC friend
  - Personal details: Actor, aspiring clown, art enthusiast
  - Questions: "How's the acting?", "Any new art discoveries?"

### Ex-Partner
- **Tia** - First love from Maine
  - Personal details: Married in Maine, shared house
  - Questions: "How have you been?", "How's Maine?"

## Technical Implementation

### Core Components

1. **RelationshipPersonalizationService** (`src/lib/services/relationshipPersonalizationService.ts`)
   - Main service handling relationship detection and personalization
   - Maintains database of known people with nicknames and details
   - Generates personalized greetings and conversation starters

2. **Chat Route Integration** (`src/app/api/chat/route.ts`)
   - Detects relationships early in conversation flow
   - Passes personalization context to deep lane
   - Uses personalized greetings instead of generic ones

3. **Deep Lane Enhancement** (`src/lib/services/deepLaneOrchestrator.ts`)
   - Incorporates relationship context into system prompts
   - Adjusts conversation style based on intimacy level
   - Provides specific instructions for known people

4. **Factbook Updates** (`src/data/jonathan_profile_factbook.json`)
   - Added nicknames and relationship details
   - Enhanced keywords for better detection
   - Included specific personal information for each person

### Detection Patterns

The system detects relationships through:

- **Direct name mentions**: "Tyler", "Krissy", "Geoff"
- **Relationship indicators**: "brother", "dad", "girlfriend"
- **Self-identification**: "It's your brother!", "Tyler here"
- **Contextual clues**: "It's me", combined with other indicators

### Memory Boosting

When relationships are detected, the system:
- Boosts relevant memories in search results
- Prioritizes relationship-specific factbook entries
- Enhances keyword matching for known people
- Provides context-aware conversation starters

## Example Interactions

### Brother (Geoff/Boris)
**Input**: "Hey! It's your brother!"
**Response**: "Hey Boris! How are my nephews? It's so good to hear from you!"

### Friend (Tyler)
**Input**: "Hi, it's me, Tyler"
**Response**: "T! How's Cansu doing? Still teaching yoga in Austin?"

### Partner (Krissy)
**Input**: "It's Krissy, babe"
**Response**: "Hey babe! How are your law studies going? Ready for some yoga later?"

### Parent (Dad)
**Input**: "Hey dad, how are you?"
**Response**: "Dad! How's retirement in Verteillac treating you? How's Mom doing?"

## Configuration

### Intimacy Instructions
Each relationship type has specific conversation guidelines:

- **Partner**: "Be loving, intimate, and playful. Use pet names and show deep affection."
- **Family**: "Be warm, loving, and reference shared memories and family connections."
- **Friend**: "Be casual, warm, and reference shared experiences and mutual friends."
- **Ex**: "Be friendly but respectful of the history between you."

### Personalization Context
The system tracks:
- Detected person information
- Personalized greeting suggestions
- Conversation starter recommendations
- Intimacy level for response styling

## Testing

### Manual Testing
```bash
# Test relationship detection
node test-relationship-detection.js

# Test full chat integration (requires dev server)
npm run dev
# Then run: node test-personalized-chat.js
```

### API Testing
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "x-session-id: test-session" \
  -d '{"avatarSlug": "jonathan-demo", "message": "Hey! It'\''s your brother!", "visitorId": "test-visitor"}'
```

## Benefits

### Enhanced User Experience
- **More Natural**: Conversations feel more authentic and personal
- **Contextual Awareness**: Responses include specific details and memories
- **Emotional Connection**: Appropriate intimacy levels for different relationships
- **Engaging**: Personalized questions keep conversations flowing

### Technical Advantages
- **Modular Design**: Easy to add new relationships or modify existing ones
- **Performance Optimized**: Lightweight detection with minimal overhead
- **Scalable**: Can handle multiple relationship types and complexity levels
- **Maintainable**: Clear separation of concerns and well-documented code

## Future Enhancements

### Potential Improvements
- **Learning System**: Adapt personalization based on conversation history
- **Emotion Detection**: Adjust responses based on detected emotional state
- **Context Memory**: Remember previous conversations with specific people
- **Dynamic Relationships**: Allow users to define their own relationships
- **Multi-language Support**: Personalization in different languages
- **Voice Adaptation**: Adjust voice tone/style based on relationship

### Advanced Features
- **Relationship Graphs**: Map complex family and friend networks
- **Temporal Awareness**: Adjust based on time since last interaction
- **Mood Tracking**: Remember and reference emotional states
- **Shared Memories**: Create and reference specific shared experiences
- **Anniversary Awareness**: Remember important dates and events

## Conclusion

The relationship personalization system transforms the jonathan-demo from a generic chatbot into a truly personal AI companion that recognizes and responds appropriately to the people in Jonathan's life. This creates more engaging, authentic, and emotionally resonant conversations that showcase the full potential of personalized AI interactions.

The system is designed to be both powerful and maintainable, with clear separation of concerns and comprehensive testing to ensure reliable operation in production environments.