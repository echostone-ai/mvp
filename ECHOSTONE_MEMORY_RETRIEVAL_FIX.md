# EchoStone Memory Retrieval & Fact Injection Fix

## Problem Analysis

### Current Issues
1. **RLS Blocking**: `fact_promotion_queue` RLS policy blocks service-role inserts
2. **Scope Mismatch**: Retrieval filters by `userId` only, excluding seeded `avatar_id` bio rows
3. **Small Candidate Pool**: Only 8 memories retrieved, embeddings weak, no lexical coverage
4. **Avatar ID Mismatch**: Demo vs API endpoints use different avatar resolution
5. **Deep Lane Cancellation**: `late_start` prevents profile memories from reaching prompt
6. **Missing Hybrid Search**: No BM25/tsvector + embeddings combination

### Root Cause
The memory system was designed for user-scoped conversations but avatars need access to their seeded biographical data (like "Favorite music: Nirvana") which is stored with `avatar_id` but no `user_id`.

## Implementation Plan

### 1. Fix RLS Policy for Fact Promotion Queue
- Allow service-role to insert into `fact_promotion_queue`
- Add bypass for demo avatars to write directly to `quick_facts`

### 2. Expand Retrieval Scope
- Modify retrieval to fetch by both `userId` AND `avatar_id`
- Ensure seeded bio rows are included in candidate pool
- Prioritize avatar-specific facts for profile questions

### 3. Improve Retrieval Quality
- Increase candidate pool to 64+ memories
- Implement hybrid search (BM25 + embeddings)
- Add exact-match boosts for preferences and pets
- Re-embed placeholder vectors

### 4. Unify Avatar Resolution
- Ensure consistent avatar ID resolution across all endpoints
- Fix demo vs API avatar ID mismatches

### 5. Enhance Deep Lane Performance
- Increase latency budget to 4000-5000ms
- Start deep retrieval on keystroke
- Guarantee deep merges before first token

### 6. Add Composer Rules for Counts
- When user asks "how many X," enumerate from retrieved fragments
- Format as "Four total—Romeo now, and before that Bucky, George, and Olive"

## Files to Modify

1. `supabase/migrations/027_fix_memory_retrieval.sql` - Database fixes
2. `src/lib/memoryService.ts` - Enhanced retrieval logic
3. `src/lib/memoryQueryOptimizer.ts` - Hybrid search implementation
4. `src/lib/services/promptBuilder.ts` - Unified avatar resolution
5. `src/lib/services/deepLaneOrchestrator.ts` - Latency improvements
6. `src/lib/services/composerRules.ts` - Count enumeration logic

## Success Metrics

### Acceptance Tests
- Q: "What's your favorite music?" → A: "Nirvana—I've always loved their sound."
- Q: "How many dogs have you had?" → A: "Four total—Romeo now, and before that Bucky, George, and Olive."
- Q: "Tell me about your dog." → A: "Romeo's my tiny toy poodle, born on Valentine's Day 2024."

### Performance Targets
- Memory retrieval: <200ms SLA maintained
- Deep lane completion: <5000ms
- Profile fact injection: 100% success rate
- Cache hit rate: >80% for common queries