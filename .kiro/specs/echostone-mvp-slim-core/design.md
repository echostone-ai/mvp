# Design Document

## Overview

The EchoStone MVP Slim Core feature implements a streamlined onboarding and memory system that ensures every avatar immediately has access to essential user information while maintaining sub-1.5s voice response times. The design focuses on three core paths: one chat path, one voice path, and one seed path, with all experimental code archived rather than deleted.

## Architecture

### Core Components

```mermaid
graph TD
    A[Onboarding UI] --> B[/api/onboarding/seed]
    B --> C[Identity Resolution Service]
    B --> D[Quick Facts Extraction]
    B --> E[Database Transaction]
    
    F[Chat Request] --> G[Enhanced Prompt Builder]
    G --> H[Quick Facts Retrieval]
    G --> I[Basics Block Assembly]
    
    J[Voice Request] --> K[/api/voice-stream]
    K --> L[Existing TTS Pipeline]
    
    M[Debug Request] --> N[/api/debug/jd]
    N --> C
    N --> O[Consolidated Debug Response]
```

### Data Flow

1. **Onboarding Flow**: User completes form → Extract/normalize facts → Single DB transaction → UI feedback
2. **Chat Flow**: Request → Resolve avatar ID → Retrieve facts → Build prompt with Basics block → Generate response
3. **Voice Flow**: Chat response → Existing streaming pipeline (unchanged) → Sub-1.5s audio
4. **Debug Flow**: Request with auth → Resolve avatar ID → Aggregate data → Consolidated response

## Components and Interfaces

### Identity Resolution Service

**File**: `src/lib/services/identity.ts`

```typescript
interface AvatarIdentifier {
  profileName?: string;
  avatarSlug?: string;
}

interface IdentityService {
  resolveAvatarId(
    identifier: AvatarIdentifier, 
    supabaseService: SupabaseClient
  ): Promise<string>;
}
```

**Behavior**:
- Try `avatar_profiles.name` first
- Fallback to `avatars.slug`
- Return `avatar_id` or throw descriptive error
- Used consistently across all services

### Quick Facts Management

**File**: `src/lib/onboarding/starterPack.ts`

```typescript
const QUICK_FACT_KEYS = [
  'full_name', 'given_name', 'pronouns', 'home_city', 'home_country',
  'timezone', 'birth_year', 'profession', 'passions', 'partner_name',
  'children', 'parents', 'pets', 'tagline', 'tone_style',
  'identity_pillars', 'signature_memories'
] as const;

interface QuickFacts {
  [K in typeof QUICK_FACT_KEYS[number]]?: string | string[];
}

interface QuickFactsService {
  normalizeQuickFacts(input: Partial<Record<string, any>>): QuickFacts;
}
```

**Normalization Rules**:
- Trim all strings
- Coerce arrays to max 3 items
- Drop empty, null, or "unknown" values
- Ensure type safety for all 17 fact keys

### Facts Extraction Service

**File**: `src/lib/onboarding/extractBasics.ts`

```typescript
interface ExtractionService {
  extractBasics(freeText: string): Promise<Partial<QuickFacts>>;
}
```

**Implementation Strategy**:
- Deterministic LLM call with ≤300 tokens, low temperature
- Regex fallbacks for common patterns (names, locations, dates)
- Return only keys within `QUICK_FACT_KEYS`
- Fail gracefully with partial extraction

### Onboarding Seed Endpoint

**File**: `src/app/api/onboarding/seed/route.ts`

```typescript
interface SeedRequest {
  avatarSlug?: string;
  profileName?: string;
  formBasics: Partial<QuickFacts>;
  freeText?: string;
}

interface SeedResponse {
  avatar_id: string;
  facts_upserted: number;
  summary_id: string;
}
```

**Transaction Steps**:
1. Resolve avatar ID using identity service
2. Extract facts from free text if provided
3. Merge and normalize form basics + extracted facts
4. Bulk upsert to `quick_facts` table (idempotent)
5. Insert `conversation_summaries` record (type='onboarding')
6. Insert `memory_fragments` if free text provided
7. Log telemetry: `JD_SEED {avatar_id, facts_count}`

### Enhanced Prompt Builder Updates

**File**: `src/lib/services/enhancedPromptBuilder.ts`

**Changes**:
- Add Basics block assembly function
- Retrieve facts via existing service client
- Prepend compact Basics block (≤300 tokens) to all prompts
- Use `resolveAvatarId` for consistent ID resolution
- Log telemetry: `JD_PROMPT {avatar_id, facts_count, tokens_basics}`

### Debug Endpoint

**File**: `src/app/api/debug/jd/route.ts`

```typescript
interface DebugResponse {
  avatar_id: string;
  quick_facts_count: number;
  sample_keys: string[];
  mem_count_last_24h: number;
  last_3_mems: Array<{
    role: 'user' | 'assistant';
    text: string;
    ts: string;
  }>;
}
```

**Security**: Requires `DEBUG_SECRET` header for access

## Data Models

### Quick Facts Schema

```sql
-- Existing table, no changes needed
quick_facts (
  id SERIAL PRIMARY KEY,
  avatar_id UUID REFERENCES avatars(id),
  fact_key VARCHAR(50),
  fact_value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Conversation Summaries Schema

```sql
-- Existing table, adding new type
conversation_summaries (
  id SERIAL PRIMARY KEY,
  avatar_id UUID REFERENCES avatars(id),
  type VARCHAR(20), -- 'onboarding' is new type
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Memory Fragments Schema

```sql
-- Existing table, adding new type
memory_fragments (
  id SERIAL PRIMARY KEY,
  avatar_id UUID REFERENCES avatars(id),
  type VARCHAR(20), -- 'onboarding_story' is new type
  text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Error Handling

### Extraction Failures
- LLM extraction errors: Fall back to regex patterns
- Regex failures: Return partial results with logging
- Complete extraction failure: Proceed with form data only

### Database Failures
- Transaction rollback on any step failure
- Detailed error logging with avatar context
- Graceful degradation for non-critical operations

### Identity Resolution Failures
- Clear error messages for missing avatars
- Fallback strategies for ambiguous matches
- Consistent error format across all services

## Testing Strategy

### Unit Tests
- `normalizeQuickFacts()` with various input types
- `extractBasics()` with sample free text
- `resolveAvatarId()` with different identifier combinations
- Prompt builder Basics block assembly

### Integration Tests
- End-to-end onboarding seed flow
- Chat prompt generation with facts
- Debug endpoint data aggregation
- Database transaction integrity

### Manual Acceptance Tests
1. Create new avatar → seed returns `facts_upserted ≥ 12`
2. Chat "Who are you?" → uses `full_name`/`given_name`/`profession`
3. Chat "Where do you live?" → uses `home_city`/`home_country`/`timezone`
4. Chat "Any pets?" → uses `pets` data if provided
5. Voice prompt "Say 'ping'" → first audio ≤1.5s
6. Debug endpoint → shows non-zero `quick_facts_count` and sample keys

## Archive Strategy

### Code Organization
- Create `archive/` directory at project root
- Use `git mv` to preserve commit history
- Maintain original directory structure within archive
- Update any remaining imports to point to archived locations

### Files to Archive

**Duplicate Chat APIs**:
- `src/app/api/reply-fast/`
- `src/app/api/chat-fast/`
- `src/app/api/conversational-ai/`
- `src/app/api/generate-followup/`
- `src/app/api/services/`

**Voice Experiments** (keep only `/api/voice-stream`):
- `src/app/api/analyze-voice*/`
- `src/app/api/improve-voice-consistency/`
- `src/app/api/clean-voice/`
- `src/app/api/preview-voice/`
- `src/app/api/generate-voice*/`
- `src/app/api/memory-voice/`
- `src/app/api/simple-voice/`
- `src/app/api/upload-voice/`
- `src/app/api/save-voice-settings/`
- `src/app/api/update-avatar-voice/`
- `src/app/api/clear-avatar-voice/`
- `src/app/api/test-voice-exists/`
- `src/app/api/train-voice/`
- `src/app/api/fix-avatar-voice*/`

**Dev/Debug/Test Endpoints**:
- `src/app/api/dev/**`
- `src/app/api/debug/**` (except new `/api/debug/jd`)
- `src/app/api/setup-jonathan-demo/`
- `src/app/api/reset-avatar-onboarding/`
- `src/app/api/test-*`

**Components**:
- `StreamingTest.tsx`
- `StreamingDebugger.tsx`
- `SeamlessStreamingTest.tsx`
- `VoicePreview*.tsx`
- `VoiceConsistencyTest.tsx`
- `VoiceSettingsOptimizer.tsx`
- `CleanChatInterface.tsx`
- `CleanHomepage.tsx`

**Pages**:
- `src/app/test-streaming/`
- `src/app/test-voice-consistency/`
- `src/app/heygen-debug/`
- `src/app/avatar-demo/`
- `src/app/conversational-onboarding/`

**Libraries**:
- `src/lib/memoryServiceQuickFix*.ts`
- `src/lib/memoryServiceUpdates*.ts`
- `src/lib/memoryServiceAvatarUpdates.ts`
- `src/lib/hybridVoiceService.ts`
- `src/lib/enhancedVoiceSystem.ts`
- `src/lib/serverAudioAnalyzer.ts`
- `src/lib/websocketManager.ts`
- `src/lib/webAudioManager.ts`
- `src/lib/improvedStreamingUtils.ts`

## Performance Considerations

### Facts Retrieval Optimization
- Index `quick_facts` table on `(avatar_id, fact_key)`
- Cache frequently accessed facts in memory
- Batch fact retrieval for prompt building
- Limit Basics block to 300 tokens maximum

### Voice Pipeline Preservation
- No changes to existing `/api/voice-stream` implementation
- Maintain current TTS streaming behavior
- Ensure facts retrieval adds <50ms to total response time
- Preserve all existing audio optimization

### Database Transaction Efficiency
- Use prepared statements for bulk upserts
- Minimize transaction scope and duration
- Implement connection pooling for concurrent requests
- Add database query monitoring for performance regression

## Security Considerations

### Debug Endpoint Protection
- Require `DEBUG_SECRET` environment variable
- Validate header presence and value
- Rate limit debug endpoint access
- Log all debug endpoint usage

### Data Validation
- Sanitize all user input before database operations
- Validate fact keys against allowed list
- Prevent SQL injection through parameterized queries
- Implement input length limits for all text fields

### Avatar Access Control
- Verify user permissions for avatar operations
- Implement consistent authorization across all endpoints
- Audit avatar access patterns
- Prevent unauthorized avatar data access