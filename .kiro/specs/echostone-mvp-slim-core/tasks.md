# Implementation Plan

- [x] 1. Create core utilities for identity resolution and quick facts
  - Implement `src/lib/services/identity.ts` with `resolveAvatarId(profileName?, avatarSlug?, supabaseSvc)` that tries avatar_profiles.name first, fallbacks to avatars.slug
  - Create `src/lib/onboarding/starterPack.ts` with `QUICK_FACT_KEYS` (17 keys: full_name, given_name, pronouns, home_city, home_country, timezone, birth_year, profession, passions, partner_name, children, parents, pets, tagline, tone_style, identity_pillars, signature_memories) and `normalizeQuickFacts` function
  - Create `src/lib/onboarding/extractBasics.ts` with deterministic LLM extraction (≤300 tokens, low temp) + regex fallbacks, returning only allowed keys
  - _Requirements: 1.1, 1.2, 6.1, 6.2_

- [x] 2. Build onboarding seed endpoint with complete flow
  - Create `src/app/api/onboarding/seed/route.ts` accepting JSON: {avatarSlug?, profileName?, formBasics, freeText?}
  - Implement single DB transaction: resolve avatar_id → extract/merge/normalize facts → bulk upsert quick_facts → insert conversation_summaries(type='onboarding') → optional memory_fragments(type='onboarding_story')
  - Log "JD_SEED {avatar_id, facts_count}" and return {avatar_id, facts_upserted, summary_id}
  - _Requirements: 1.1, 1.3, 1.4, 7.2, 7.3_

- [x] 3. Update prompt builder to always include Basics block
  - Modify `src/lib/services/enhancedPromptBuilder.ts` to prepend compact Basics block (≤300 tokens) from quick_facts using existing service client
  - Use `resolveAvatarId` for consistent ID resolution and add "JD_PROMPT {avatar_id, facts_count, tokens_basics}" logging
  - Ensure minimal changes to existing prompt building logic
  - _Requirements: 2.1, 2.5, 6.2_

- [x] 4. Create single consolidated debug endpoint
  - Implement `src/app/api/debug/jd/route.ts` requiring DEBUG_SECRET header, accepting avatarSlug or profileName query
  - Return {avatar_id, quick_facts_count, sample_keys[≤12], mem_count_last_24h, last_3_mems} using resolveAvatarId + service client
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Update onboarding UI and chat endpoint
  - Modify `src/app/onboarding/page.tsx` to call `/api/onboarding/seed` and show "Basics ready" checkmark on success
  - Update `src/app/api/chat/route.ts` to use `resolveAvatarId` for consistent avatar identification (minimal changes only)
  - _Requirements: 7.1, 7.2, 2.2, 2.3, 2.4_

- [x] 6. Archive non-essential code using git-move
  - Create `archive/` directory and use `git mv` to preserve history while moving:
  - Duplicate chat APIs: `src/app/api/{reply-fast,chat-fast,conversational-ai,generate-followup,services}/`
  - Voice experiments: all `src/app/api/*voice*` except `voice-stream`
  - Dev/debug/test scatter: `src/app/api/dev/**`, `src/app/api/debug/**` (except new jd), test endpoints
  - Unused components: streaming tests, voice previews, debug components
  - Unused libs: memory quick fixes, voice/audio managers
  - Demo/test pages: test-streaming, test-voice-consistency, avatar-demo, etc.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Build validation and manual acceptance testing
  - Run `pnpm build` and `pnpm typecheck` - both must pass without errors
  - Manual QA checklist:
    - Create avatar → `/api/onboarding/seed` returns `facts_upserted ≥ 12`
    - Chat "Who are you?" → uses full_name/given_name/profession from Basics
    - Chat "Where do you live?" → uses home_city/home_country/timezone
    - Chat "Any pets?" → uses pets data if provided
    - Voice "Say 'ping'" → first audio ≤1.5s via `/api/voice-stream`
    - Debug `/api/debug/jd` with DEBUG_SECRET → shows non-zero quick_facts_count
  - _Requirements: 8.1, 8.2, 8.3, 2.2, 2.3, 2.4, 3.2, 4.2_