# EchoStone Factbook-Only Implementation

## Overview

This implementation provides a "factbook-only" mode that bypasses Supabase memory RPCs and relies exclusively on the factbook for memory retrieval, with tightened latency parameters for faster response times.

## Key Changes

### 1. Lazy Singleton Factbook Loader

- **Files**: `src/app/api/chat/route.ts`, `src/app/api/demo-chat/route.ts`
- **Change**: Added `ensureFactbookLoaded()` function that loads the factbook once from the correct path (`data/jonathan_profile_factbook.json`)
- **Benefit**: Eliminates per-request factbook reloading, improving performance

### 2. Environment Flag for Factbook-Only Mode

- **Environment Variable**: `ECHOSTONE_FACTBOOK_ONLY=1`
- **Files**: 
  - `src/app/api/chat/route.ts` (getPinnedMemoriesWithTimeout function)
  - `src/lib/services/deepLaneOrchestrator.ts` (fallback logic)
- **Behavior**: When set to `1`, disables all Supabase memory RPCs and uses only factbook retrieval

### 3. Tightened Merge Configuration

- **File**: `src/config/personalization.ts`
- **Changes**:
  - `mergeWindowMs`: 3500ms → 1200ms (66% reduction)
  - `minDeepBudgetMs`: 650ms → 400ms (38% reduction)  
  - `fastMaxTokens`: 60 → 80 (33% increase)
- **Benefit**: Faster response times while giving fast lane more room

### 4. Deep Lane Never Overwrites Fast Lane

- **File**: `src/app/api/chat/route.ts`
- **Change**: `deepMustContribute` is set to `false` when `ECHOSTONE_FACTBOOK_ONLY=1`
- **Benefit**: Ensures fast lane always wins, deep lane only appends

## File Structure

```
data/jonathan_profile_factbook.json  # Factbook data (moved from src/data/)
scripts/eval.mjs                     # Evaluation harness
test-factbook-setup.js               # Setup verification script
```

## Usage

### Enable Factbook-Only Mode

```bash
export ECHOSTONE_FACTBOOK_ONLY=1
npm run dev
```

### Run Evaluation Tests

```bash
# Start the dev server first
npm run dev

# In another terminal
./scripts/eval.mjs
```

### Verify Setup

```bash
node test-factbook-setup.js
```

## Success Criteria

The evaluation script checks for:

1. **First token latency**: < 350ms median
2. **Total response time**: < 2.8s median  
3. **Factbook content**: 80%+ of responses contain factbook keywords
4. **No Supabase RPCs**: When `ECHOSTONE_FACTBOOK_ONLY=1`, no memory RPC calls are logged

## Performance Improvements

- **Factbook loading**: Once per server start vs. per request
- **Memory retrieval**: Factbook-only (no network calls) vs. Supabase RPC fallback
- **Merge window**: 1.2s vs. 3.5s (66% faster)
- **Deep lane startup**: 400ms vs. 650ms budget (38% faster)

## Rollback Plan

To disable factbook-only mode:

```bash
export ECHOSTONE_FACTBOOK_ONLY=0
# or unset the variable
unset ECHOSTONE_FACTBOOK_ONLY
```

The system will fall back to the previous behavior with Supabase memory RPCs enabled.

## Testing

Run the evaluation harness to verify performance:

```bash
./scripts/eval.mjs
```

Expected output:
- ✅ First token < 350ms
- ✅ Total time < 2.8s  
- ✅ Factbook content present
- 🏆 OVERALL: PASS