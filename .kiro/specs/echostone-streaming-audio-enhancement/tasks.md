# Implementation Plan

## P0 Tasks (Must-Have Next)

- [x] 1. Implement enhanced voice configuration for premium quality
  - Create `src/lib/enhancedVoiceConfig.ts` with 44.1kHz, ≥64kbps, latency mode 3 settings
  - Update voice-stream API endpoint to accept and use enhanced voice configuration
  - Implement automatic fallback to lower quality settings if high-quality synthesis fails
  - Add voice quality validation: SNR check and AB test panel ≥80% pass-rate vs old config
  - Ensure consistent audio levels throughout conversation playback
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Replace jonathan-demo one-shot TTS with StreamingAudioManager
  - Modify `src/app/jonathan-demo/page.tsx` to use `createStreamingAudioManager` with enhanced voice config (requires Task 1)
  - Replace the current `askQuestion` function's TTS generation with streaming sentence-by-sentence playback
  - Remove existing `playAudioBlob` function and integrate with StreamingAudioManager's queue system
  - Ensure proper cleanup and error handling for streaming audio
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Wire StreamingAudioManager with expression system (overlays disabled)
  - Modify StreamingAudioManager initialization in jonathan-demo to accept expression packs
  - Add feature flag `EXPRESSION_OVERLAYS_ENABLED` defaulting to false
  - Implement expression pack loading infrastructure without activating overlays
  - Add expression system integration points for future P1 activation
  - _Requirements: 3.1, 6.1_

- [x] 4. Add persistent memory integration to jonathan-demo conversations
  - Modify jonathan-demo to retrieve relevant memories before generating responses
  - Integrate memory context into chat API calls for conversation continuity
  - Implement asynchronous memory storage after each conversation turn
  - Ensure memory retrieval adds <200ms overhead to response generation
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

## P1 Tasks (Important)

- [x] 5. Enable expression overlays with quality constraints
  - Enable `EXPRESSION_OVERLAYS_ENABLED` feature flag in jonathan-demo
  - Connect expression scheduling to TTS streaming without blocking audio start
  - Ensure expression overlays use existing normalization (-14 LUFS, true-peak < -1 dBTP)
  - Implement maximum 2 overlays per 10-second window constraint with ducking (0.4 level)
  - Add LUFS validation gate and peak/RMS checks after normalization
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 6. Implement expression preloading and buffer management
  - Add expression buffer preloading to StreamingAudioManager initialization (required before Task 5)
  - Implement buffer cleanup and memory management for expression audio
  - Add error handling for failed expression loads without blocking TTS
  - Create expression buffer validation and format checking
  - _Requirements: 3.6, 6.2_

- [x] 7. Optimize memory retrieval performance with indexing
  - Create GIN index on embedding column in memory_fragments table
  - Cap memory retrieval to top-6 fragments with max 300 tokens
  - Implement memory cache warming on first conversation turn
  - Add memory retrieval performance monitoring with <200ms SLA
  - _Requirements: 4.2_

- [x] 8. Add conversation state management and persistence
  - Create conversation state tracking for jonathan-demo sessions
  - Implement conversation ID generation and persistence across browser sessions
  - Add conversation history management with proper memory fragment association
  - Implement conversation cleanup and archival for long-running sessions
  - _Requirements: 4.6_

- [x] 9. Implement Mobile Safari audio context optimization
  - Add single-gesture audio context initialization with "Tap to enable audio" UX
  - Implement AudioContext state persistence and recovery across background/lock transitions
  - Add mobile-specific audio buffer management and optimization
  - Create fallback audio playback for mobile compatibility issues
  - _Requirements: 6.3_

- [x] 10. Create enhanced error handling and graceful degradation
  - Implement circuit breaker for ElevenLabs failures (5xx/timeout → 30s fallback)
  - Add automatic retry logic with exponential backoff for voice synthesis
  - Create graceful degradation paths for memory service failures
  - Implement user-friendly toast notifications for degradations (short, non-technical copy)
  - _Requirements: 1.4, 2.4, 4.5, 6.4_

- [x] 11. Add performance monitoring and metrics dashboard
  - Implement OpenTelemetry + OTLP → Grafana/Tempo/Loki monitoring stack
  - Add counters: tts_first_byte_ms, overlay_injections_count, overlay_dropped_count, memory_fetch_ms, stream_interrupts
  - Create expression overlay usage and timing metrics
  - Build performance dashboard for monitoring system health with SLA tracking
  - _Requirements: 6.6, 6.7_

## P2 Tasks (Nice-to-Have)

- [x] 12. Implement simplified expression upload interface
  - Create user-friendly expression upload component for jonathan-demo
  - Add automatic audio format conversion and normalization
  - Implement expression categorization and preview functionality
  - Add expression management interface with preview playback and easy removal/replacement
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 13. Add advanced memory ranking and relevance scoring
  - Implement memory fragment relevance ranking before context injection
  - Add conversation topic tracking and memory categorization
  - Create memory freshness scoring and automatic archival
  - Implement memory deduplication and consolidation
  - _Requirements: 4.3_

- [x] 14. Implement conversation analytics and optimization
  - Add conversation flow analysis and optimization suggestions
  - Implement user engagement tracking and conversation quality metrics
  - Create A/B testing framework for voice settings and expression timing
  - Add conversation export and sharing functionality
  - _Requirements: 6.7_

- [x] 15. Add advanced expression scheduling algorithms
  - Implement context-aware expression selection based on conversation history
  - Add emotional state tracking for more appropriate expression timing
  - Create adaptive expression frequency based on user preferences
  - Implement expression learning from user feedback and interaction patterns
  - _Requirements: 3.1, 3.2_

- [x] 16. Implement cross-device conversation synchronization
  - Add conversation state synchronization across multiple devices
  - Implement real-time conversation updates and conflict resolution
  - Create device-specific audio optimization and format selection
  - Add conversation handoff between devices with state preservation
  - _Requirements: 4.6_

- [x] 17. Create comprehensive testing and validation suite
  - Implement automated audio quality validation tests
  - Add performance regression testing for latency and memory usage
  - Create user acceptance testing framework for conversation naturalness
  - Implement load testing for concurrent conversation handling
  - _Requirements: 6.5, 6.6_