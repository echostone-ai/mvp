# Implementation Plan

- [x] 1. Fix expression player initialization awaiting in streamingUtils.ts
  - Modify the `ensureExpressionPlayerReady()` method to properly await the initialization promise
  - Call `ensureExpressionPlayerReady()` and await it in the code path just before `playExpressionsForText()`
  - Add console logging to confirm when expression player becomes ready
  - Add feature flag check: wrap trigger in `EXPRESSION_OVERLAYS_ENABLED` feature flag
  - _Requirements: 1.4_

- [x] 2. Add hardcoded trigger mapping and enhanced logging in simpleExpressionPlayer.ts
  - Normalize input to lowercase and strip punctuation before matching (so "That's funny!" triggers)
  - Add explicit check for "funny" keyword in `playExpressionsForText()` method
  - Add simple throttle: allow at most 1 overlay per 8 seconds to prevent stacking
  - Add console logging for expression trigger events with timestamp
  - Add console logging for expression completion events with duration
  - Add debug logging for non-trigger cases: "[overlay: no match]" when no expressions found
  - Ensure logging format matches requirements: "[overlay: laugh triggered]" and "[overlay: laugh completed @1.8s]"
  - _Requirements: 1.1, 2.2, 2.3_

- [x] 3. Verify concurrent audio playback without TTS blocking
  - Confirm both TTS and overlay share one AudioContext and use distinct GainNodes
  - Ensure overlay nodes are disconnected on ended to avoid memory leaks
  - Preload the laugh clip once on initialization and log if fetch/decode fails
  - Test that expressions use separate AudioBufferSourceNode instances
  - Verify Mobile Safari compatibility: overlay plays after initial user gesture using same context
  - Confirm TTS continues normally when expressions play
  - _Requirements: 1.3, 3.5_

- [x] 4. Test the complete implementation with both trigger and non-trigger cases
  - Test "that's funny" input triggers laugh expression with proper logging
  - Test "hello there" input shows "[overlay: no match]" or no overlay logs (negative case assertion)
  - Test throttling: multiple "funny" inputs within 8 seconds should only trigger once
  - Test punctuation handling: "That's funny!" should trigger same as "funny"
  - Verify consistent behavior across multiple test runs
  - Confirm total code changes are under 20 lines
  - _Requirements: 2.1, 2.4, 3.3_