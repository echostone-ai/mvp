# Implementation Plan

- [x] 0. Add feature flags and kill switch for safe rollout
  - Implement FACTBOOK_ENABLED (default true in demo) and FALLBACK_PIPELINE_ENABLED (default false) environment variables
  - Create runtime kill switch endpoint that can flip to old pipeline if issues arise
  - Add feature flag checks in /api/chat route to toggle between factbook and legacy memory systems
  - _Requirements: 8.4, 8.5_

- [x] 1. Create enhanced factbook JSON structure with validation
  - Expand jonathan_profile.json with hierarchical structure including identity, timeline, relationships, pets, opinions sections
  - Add unique ID per snippet, topics, keywords, and strict text length constraints (≤400 chars)
  - Include topic fencing data to prevent cross-contamination between pets/politics/places
  - Create factbook.schema.json with AJV-compatible validation rules for boot-time and runtime validation
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.3_

- [x] 2. Create minimal fixture and early golden tests
  - Build jonathan_profile_min.json with 3 core topics (Olive, Austin, Tyler) for testing
  - Implement 2 golden tests: "Tell me about Olive" and "When did you live in Austin"
  - Add CI job that runs hook timing gate (<300ms) and golden assertions after core infrastructure
  - Create /api/factbook/validate endpoint for testing new JSON structures
  - _Requirements: 9.1, 9.2, 9.5_

- [x] 3. Implement FactbookService core infrastructure with deterministic ranking
  - Create FactbookService singleton class with AJV validation at server boot
  - Build in-memory indexing system with flattened path → snippet mapping and keyword → paths mapping
  - Implement deterministic ranking: +2 for exact entity match, +1 for topic match, -0.4 for no entities, -∞ for topic fence violations
  - Add lexicographic tie-breaking and O(n) boot time with O(m) query time constraints
  - _Requirements: 1.5, 2.4, 5.1, 5.2, 8.1, 8.4_

- [x] 4. Create LightweightAnalyzer with token normalization
  - Implement keyword and entity extraction with lowercase normalization, ASCII folding, and stopword removal
  - Add topic classification and strict topic fence enforcement to prevent cross-contamination
  - Create deterministic query analysis that maps to ≤3 relevant snippets using weighted scoring
  - Include intent detection for factual vs opinion vs story queries with <10ms processing time
  - _Requirements: 3.4, 5.3, 5.4_

- [x] 5. Build FastHookSelector with strict formatting guardrails
  - Enhance existing FastHookSelector to work with factbook snippets instead of database memories
  - Implement hook generation that caps at 160 characters, avoids emojis, and never includes newlines
  - Create coordination hints system that includes source snippet IDs for deep lane handoff
  - Add fallback responses when no relevant factbook data exists
  - _Requirements: 1.1, 4.1, 4.2, 7.4_

- [x] 6. Separate facts from style with StyleProfile layer
  - Create StyleProfile object in code for voice tics, personality markers, and conversational style
  - Keep pure facts in factbook, apply style as post-processing layer after fact selection
  - Implement "facts first → then apply StyleProfile" pattern in deep lane prompt construction
  - Ensure personality never pollutes factbook content or influences fact selection
  - _Requirements: 7.2, 7.3_

- [x] 7. Integrate factbook system with /jonathan-demo endpoint
  - Replace existing memory retrieval in /api/chat route with FactbookService queries when FACTBOOK_ENABLED=true
  - Ensure fast lane responds in <300ms using factbook snippets only
  - Start ElevenLabs TTS streaming immediately with hook content, never await deep lane
  - Add single-line chat_metrics logging: trace_id, hook_ms, deep_first_ms, deep_done_ms, snippets, overlap
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

- [x] 8. Implement DeepLaneCoordinator with factbook-only responses
  - Create deep lane system that receives same snippets plus coordination hints with source snippet IDs
  - Build response generation that uses ONLY factbook content with StyleProfile applied after fact selection
  - Implement system prompt: "You are Jonathan Braden. Answer ONLY with facts from the Factbook unless asked for opinions or style"
  - Ensure deep lane continues streaming after merge window even if fast lane finalizes
  - _Requirements: 4.3, 4.4, 7.2, 7.3, 7.5_

- [x] 9. Add efficient n-gram overlap prevention system
  - Implement character-level 3-gram Jaccard similarity check with 0.3 threshold before first deep token
  - Add single regeneration attempt when overlap exceeds threshold, then truncate hook from deep response if still overlapping
  - Optimize for speed to avoid blowing 1s deep lane budget with multiple regenerations
  - Log overlap percentages in chat_metrics for monitoring
  - _Requirements: 4.5, 6.2_

- [x] 10. Optimize ElevenLabs integration with voice warming
  - Warm voice session at server boot with 1-word synthesis ("Hi") and cache session
  - Implement voice model caching to minimize first-audio delay to <200ms after hook production
  - Ensure ElevenLabs streaming starts immediately, never await deep lane completion
  - Add text-only fallback when voice synthesis fails without blocking response flow
  - _Requirements: 1.2, 8.3_

- [x] 11. Create comprehensive test suite with expanded golden outputs
  - Expand to 6-8 test queries including "Tell me about Olive", "When did you live in Austin", "Tell me about Tyler"
  - Add negative tests for unknown topics and topic fence violations
  - Build performance tests that fail CI if t_hook_ms > 300ms or t_deep_done_ms > 1000ms
  - Include zero-hallucination audit tests that verify all responses map to factbook snippet IDs
  - _Requirements: 3.1, 3.2, 3.3, 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 12. Add monitoring dashboard with live metrics
  - Create tiny /metrics viewer page that renders last 20 chat_metrics log lines as a table
  - Add factbook health monitoring with corruption detection and atomic index rebuild capability
  - Implement memory usage monitoring and factbook size constraint warnings
  - Include live SLA proof showing hook timing and deep lane performance in real-time
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.4_

- [x] 13. Create factbook hot-reload system with atomic swaps
  - Implement debounced file watcher (250ms) with JSON validation before reload
  - Add atomic index swapping that keeps previous index until new one validates successfully
  - Create factbook versioning system with version tags in logs for rollback capability
  - Build memory footprint monitoring for multiple avatar factbooks with size warnings
  - _Requirements: 8.4_

- [ ] 14. Add security and safety hardening
  - Implement rate limiting on /api/chat with token bucket algorithm
  - Ensure raw factbook content is never exposed via API endpoints
  - Add log redaction that prints only snippet IDs and timings, never full response text
  - Create security audit checklist for demo deployment readiness
  - _Requirements: 2.4, 6.4_

- [ ] 15. Final integration testing and demo polish
  - Run comprehensive end-to-end tests with all acceptance criteria and SLA gates
  - Validate Apple-like experience: instant responses, no hallucination, crisp coordination
  - Test topic fencing thoroughly with adversarial queries to ensure no cross-contamination
  - Verify performance targets are consistently met under load with live monitoring dashboard
  - _Requirements: 1.4, 2.1, 3.1, 3.2, 3.3, 8.5_