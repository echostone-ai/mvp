# Universal Avatar Memory & Style System

This document outlines the implementation of the enhanced backend pipeline for avatar memory persistence and natural language style support. While initially developed for jonathan-demo, this system provides the same friendly, personalized conversation logic for **all avatars** created by users.

## Overview

The upgrade implements a three-tier data pipeline with enhanced style and expression support:

- **Hot data**: `quick_facts` for fast retrieval of core identity, style, expressions, and catchphrases
- **Warm data**: `memory_fragments` with conversation context and tags
- **Cold data**: Archived memories and low-priority facts

## Key Features

### Universal Natural Conversation Logic
Every avatar created with this system gets the same intelligent, natural conversation abilities:
- **Smart fact connection**: "Who's [pet name]?" gets proper responses, not "I don't have that yet"
- **Context-aware responses**: Avatars understand relationships between their facts
- **Natural information flow**: Facts are organized and presented in a way that makes sense
- **Expression management**: Avatars use their unique expressions and catchphrases naturally

### 1. Enhanced Style & Expression System

#### Style Profile Structure
```typescript
interface EnhancedStyleProfile {
  speaking_style?: string;
  address_male_friend?: string;  // "man | my man"
  expressions?: { [key: string]: string };  // "what's up?!", "it was WILD!"
  catchphrases?: { [key: string]: string }; // "man time flies", "that's a trip"
}
```

#### Expression Usage Rules
- **Sparing usage**: Max once every 3-4 turns
- **No consecutive usage**: Never in two consecutive turns unless user mirrors it
- **Context-appropriate**: Natural, contextually fitting usage
- **Male friend terms**: Only with clearly familiar male friends or inviting tone

### 2. Memory Injection Pipeline

#### Automatic Fact Extraction
- Extracts facts from user messages using LLM
- Stores high-confidence facts (≥0.7) in `quick_facts`
- Queues lower-confidence facts for potential promotion
- Supports priority-based fact organization (1=core identity, 5=trivia)

#### Fact Storage Schema
```sql
-- quick_facts table structure
key: expression_whats_up -> "what's up?!"
key: catchphrase_man_time_flies -> "man time flies"  
key: address_male_friend -> "man | my man"
priority: 4 (for expressions/catchphrases)
confidence: 0.95
source: 'manual' | 'llm' | 'extraction'
```

### 3. Enhanced Prompt Building

#### System Prompt Structure
```
CORE IDENTITY (Priority 1-2 Facts):
- Full Name: Jonathan Braden
- Height: 6'7" (very tall)
- Current Location: Sofia, Bulgaria

STYLE & TONE:
Base style: Casual, warm, personable. Greet with warmth.
Male friend terms: Use "man" / "my man" only with clearly familiar male friends...
Signature expressions: "what's up?!", "it was WILD!", "good times!"
Use each expression sparingly — max once every 3–4 turns...
Catchphrases: "man time flies", "that's a trip", "wild!"
Treat catchphrases like expressions — natural, sparing, contextually fitting.
Conversation memory: Weave in facts/expressions naturally based on context...

LIFE CONTEXT (Priority 3-5 Facts):
- Pet Name: Romeo
- Pet Type: toy poodle
- Company: EchoStone.ai (founder)

RELEVANT MEMORIES:
[Context-relevant memories with relevance scores]

CONVERSATION SO FAR:
[Last 6 turns for expression tracking]
```

## Implementation

### Core Services

#### 1. EnhancedPromptBuilder
- Extends base PromptBuilder with style support
- Tracks expression usage across conversation turns
- Provides usage guidance (recently used expressions marked)
- Supports priority-based fact organization

#### 2. MemoryInjectionService
- Extracts facts from conversation messages
- Stores facts in appropriate priority tiers
- Supports batch fact storage for onboarding
- Handles fact confidence and source tracking

#### 3. AvatarOnboardingService
- Creates avatars with style configuration
- Stores expressions as `expression_*` facts
- Stores catchphrases as `catchphrase_*` facts
- Supports address term configuration

### API Endpoints

#### Setup Jonathan-demo
```bash
POST /api/setup-jonathan-demo
# Sets up jonathan-demo with predefined expressions and catchphrases
```

#### Update Avatar Style
```bash
PUT /api/avatars/[slug]/style
{
  "expressions": ["what's up?!", "it was WILD!", "good times!"],
  "catchphrases": ["man time flies", "that's a trip"],
  "address_terms": {
    "male_friend": ["man", "my man"]
  }
}
```

#### Enhanced Avatar Creation
```bash
POST /api/avatars/create-enhanced
{
  "name": "sarah-professional",
  "speaking_style": "Professional, warm, and encouraging",
  "expressions": ["that's excellent!", "I love that!", "fantastic work!"],
  "catchphrases": ["you know what I mean?", "that's the key thing"],
  "address_terms": {
    "male_friend": ["my friend", "buddy"]
  },
  "core_facts": [
    {"key": "full_name", "value": "Sarah Johnson", "priority": 1},
    {"key": "profession", "value": "Software Engineering Manager", "priority": 2},
    {"key": "pet_name", "value": "Whiskers", "priority": 2},
    {"key": "pet_type", "value": "tabby cat", "priority": 3},
    {"key": "pet_description", "value": "Whiskers is my tabby cat who keeps me company", "priority": 3}
  ]
}
```

### Create Multiple Avatar Examples
```bash
npx tsx src/scripts/createExampleAvatars.ts
```
This script creates 4 different avatar personalities, each with natural conversation support.

### Updated Chat Endpoints

Both `/api/chat` and `/api/reply` now:
- Use EnhancedPromptBuilder for style-aware prompts
- Inject facts from user messages automatically
- Track expression usage across conversation turns
- Support conversation memory for natural fact/expression weaving

## Example Avatar Configurations

### Jonathan-demo (Original)
**Expressions**: `"what's up?!"`, `"it was WILD!"`, `"good times!"`  
**Catchphrases**: `"man time flies"`, `"that's a trip"`, `"wild!"`  
**Address Terms**: `"man"` / `"my man"` (for familiar male friends)  
**Pet**: Romeo (toy poodle, born Valentine's Day 2024)

### Sarah-professional (Example)
**Expressions**: `"that's excellent!"`, `"I love that!"`, `"fantastic work!"`  
**Catchphrases**: `"you know what I mean?"`, `"that's the key thing"`  
**Address Terms**: `"my friend"`, `"buddy"`  
**Pet**: Whiskers (tabby cat, 3 years old)

### Mike-casual (Example)
**Expressions**: `"dude, that's awesome!"`, `"no way!"`, `"totally rad!"`  
**Catchphrases**: `"you feel me?"`, `"that's sick"`, `"for sure"`  
**Address Terms**: `"dude"`, `"bro"`, `"man"`  
**Pet**: Buddy (golden retriever who loves the beach)

### Dr. Elena-academic (Example)
**Expressions**: `"how fascinating!"`, `"that's quite interesting!"`, `"remarkable!"`  
**Catchphrases**: `"as they say"`, `"in my experience"`, `"that reminds me"`  
**Address Terms**: `"my dear colleague"`, `"my friend"`  
**Pet**: Darwin (African Grey parrot who can say over 100 words)

## Usage Examples

### 1. Natural Greeting
```
User: "Hey Jonathan!"
Jonathan: "Hey! What's up?! Good to see you."
```

### 2. Male Friend Interaction
```
User: "Yo Jonathan, how's it going man?"
Jonathan: "Hey my man! Things are good, thanks for asking."
```

### 3. Story Emphasis
```
User: "How was your trip?"
Jonathan: "Oh man, it was WILD! So many unexpected things happened."
```

### 4. Fact Learning
```
User: "I have a cat named Whiskers"
System: [Automatically extracts and stores: pet_name="Whiskers", pet_type="cat"]
Jonathan: "That's awesome! I love cats. Romeo would probably be curious about Whiskers."
```

## Testing

Run the test script to verify implementation:
```bash
npx tsx src/scripts/testJonathanDemo.ts
```

Tests cover:
- Jonathan-demo setup with expressions
- Enhanced prompt building
- Fact injection from messages
- Expression usage tracking
- Style-aware conversation flow

## Universal Avatar Capabilities ✅

### Natural Conversation Logic (All Avatars)
- [x] **Smart fact connection**: "Who's [pet name]?" gets proper responses, not "I don't have that yet"
- [x] **Context-aware responses**: Avatars understand relationships between their facts
- [x] **Natural information flow**: Facts organized by category (PETS, FAMILY, WORK, etc.)
- [x] **Name-based query detection**: Automatically finds relevant facts when asked about specific names

### Expression & Style System (All Avatars)
- [x] **Custom expressions**: Each avatar can have unique expressions used naturally
- [x] **Custom catchphrases**: Personalized catchphrases used sparingly and contextually
- [x] **Address term management**: Smart use of familiar terms based on context
- [x] **Usage tracking**: Prevents overuse of expressions (max once every 3-4 turns)

### Memory & Learning (All Avatars)
- [x] **Automatic fact injection**: Learns new facts from conversations
- [x] **Persistent memory**: Remembers facts across conversations
- [x] **Priority-based organization**: Core identity vs casual details
- [x] **Cross-conversation continuity**: Facts learned in one session available in future chats

### Avatar Creation & Management
- [x] **Enhanced onboarding**: Easy creation with expressions and catchphrases
- [x] **Style updates**: Modify avatar expressions and catchphrases after creation
- [x] **Example templates**: Multiple personality archetypes available
- [x] **Universal API**: Same creation process works for all avatar types

## Database Changes

The implementation uses the existing `quick_facts` table structure with new key patterns:
- `expression_*`: Signature expressions
- `catchphrase_*`: Catchphrases  
- `address_male_friend`: Male friend address terms
- `speaking_style`: Base communication style

No schema changes required - leverages existing hot/warm/cold data pipeline.