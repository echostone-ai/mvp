# Implementation Plan

## Overview

Implement a lightweight coordination layer between fast and deep lanes to eliminate repetition while maintaining the performance and stability we just achieved. This approach uses surgical edits to existing code rather than building new subsystems.

## Tasks

- [x] 1. Create lightweight memory analysis helper
  - Add simple `lightAnalyze()` function that categorizes memories without extra RPCs
  - Extract hook potential, content type, and key entities using heuristics
  - Keep analysis O(n) and under 10ms total
  - _Requirements: 1.3, 5.2_

- [x] 2. Implement fast lane hook selector
  - Create `selectFastHook()` function that picks best 1-2 sentence hook
  - Generate explicit handoff hints (expandOn IDs, avoidRepeating phrases, tone)
  - Cap hook text to ~180 characters for quick delivery
  - _Requirements: 2.1, 2.4, 5.3_

- [x] 3. Add coordination to fast lane response generation
  - Integrate hook selector into existing fast lane logic
  - Use selected hook text instead of current memory truncation approach
  - Pass handoff hints to deep lane coordination
  - _Requirements: 1.1, 2.2, 4.1_

- [x] 4. Enhance deep lane with coordination prompts
  - Add coordination rules to deep lane system prompt
  - Include expandOn memory IDs and avoidRepeating phrases in prompt
  - Instruct model to build on fast lane hook without repetition
  - _Requirements: 3.1, 3.3, 4.2_

- [x] 5. Implement pre-stream repetition guard
  - Add overlap detection before streaming first deep token
  - Check for n-gram overlap between fast hook and deep draft
  - Regenerate deep response if overlap exceeds 30% threshold
  - _Requirements: 1.3, 4.3, 5.4_

- [x] 6. Fix pinned memory race conditions
  - Clear timeout on both resolve/reject in memory retrieval
  - Guarantee single terminal log (either completed or timeout, not both)
  - Prevent double-firing of timeout handlers
  - _Requirements: 5.1, 5.5_

- [x] 7. Optimize memory sorting and filtering
  - Maintain opinion > bio > friend_memory priority order
  - Add -0.4 penalty for memories without entities
  - Cap generic user/assistant conversation turns to max 2 in pins
  - _Requirements: 1.4, 5.2_

- [x] 8. Prevent premature deep lane abortion
  - Stop finalizing deep lane early on merge window expiry
  - Let fast lane finalize while deep continues streaming
  - Log final deep_merge status based on actual production
  - _Requirements: 4.4, 5.5_

- [x] 9. Add coordination logging and metrics
  - Log hook selection and handoff hints for debugging
  - Track n-gram overlap percentages between lanes
  - Add compact chat_metrics log line per turn
  - _Requirements: 5.5_

- [x] 10. Create coordination acceptance tests
  - Test fast lane hook selection for different intents
  - Verify deep lane builds on fast lane without repetition
  - Validate coordination works for opinion, travel, and people queries
  - Ensure performance stays under 200ms fast, 1.2s total
  - _Requirements: 1.1, 1.2, 1.3, 4.1_