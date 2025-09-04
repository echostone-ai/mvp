# Implementation Plan

## Phase 0: Foundations (Ship behind feature flag)

- [x] 1. Create database schema and core data models
  - Create user_stories table migration with simplified trigger storage (comma-separated text)
  - Implement UserStory TypeScript interface and validation schemas
  - Add database constraints for 5-story limit per avatar
  - Add API-level enforcement of 5-story limit (defense in depth)
  - Create story_usage_analytics table for basic tracking
  - _Requirements: 5.1, 5.6_

- [x] 2. Implement story storage and file management service
  - Create UserStoryStorageService extending existing ExpressionStorageService patterns
  - Implement story file upload with 10MB limit, MP3 validation, and virus/mime checking
  - Add audio duration validation (30s-5min) and reject invalid files with user-friendly errors
  - Create CDN URL generation and storage path management
  - Write unit tests for file validation and storage operations
  - _Requirements: 1.1, 1.4, 5.5_

- [x] 3. Build story management CRUD operations
  - Implement createStory, getStories, updateStory, deleteStory methods
  - Add story metadata validation (title, category, triggers, duration)
  - Create database queries with proper indexing for performance
  - Implement authorization: creators can only CRUD their avatar's stories
  - Write comprehensive unit tests for all CRUD operations
  - _Requirements: 1.1, 1.2, 5.6_

- [x] 4. Create minimal API endpoints (POST/GET only)
  - Implement POST /api/stories for story upload and creation
  - Create GET /api/stories for retrieving user/avatar stories
  - Add proper authentication and authorization for story access
  - Add rate limiting on uploads (prevent abuse)
  - Implement feature flag gating: STORIES_ENABLED (global) + per-avatar toggle
  - _Requirements: 1.1, 1.2, 5.1_

- [x] 5. Build basic story management UI
  - Create StoryUploader component for file upload and metadata entry
  - Implement StoryList component for displaying existing stories
  - Add basic delete functionality for story management
  - Create category selection and trigger keyword input interfaces
  - Implement progress indicators and error handling in UI
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

## Phase 1: Playback MVP (Option A only)

- [x] 6. Create simplified trigger matching system
  - Implement exact case-insensitive keyword matching (no fuzzy matching yet)
  - Create simple text normalization and tokenization
  - Use upload order for story selection (no priority scoring yet)
  - Implement 30-second cooldown mechanism per avatar
  - Write unit tests for trigger matching accuracy and performance
  - _Requirements: 2.1, 2.2, 8.2_

- [x] 7. Build story audio management and playback system
  - Create StoryAudioManager for handling story playback integration
  - Implement audio buffer preloading with 2-second timeout constraint
  - Add graceful fallback to TTS when story loading fails or times out
  - MVP concurrency: ignore new triggers if story is playing (no queueing yet)
  - Write integration tests for audio playback and fallback scenarios
  - _Requirements: 3.1, 3.3, 3.5, 8.6_

- [x] 8. Integrate stories with existing StreamingAudioManager
  - Extend StreamingAudioManager to support story replacement of TTS
  - Modify conversation flow to check for story triggers before TTS synthesis
  - Implement Option A: complete TTS replacement with story audio
  - Add feature flag gating around replacement path
  - Ensure mobile Safari compatibility with existing audio context management
  - _Requirements: 3.4, 4.1, 4.4, 7.1_

- [x] 9. Implement comprehensive error handling and fallback
  - Create StoryErrorHandler for managing all story-related failures
  - Implement graceful degradation when stories fail to load or play
  - Add automatic TTS fallback with seamless conversation continuation (no gap >150ms)
  - Create error recovery mechanisms for network and audio issues
  - Write integration tests for all error scenarios and fallback paths
  - _Requirements: 3.5, 7.5, 8.6_

- [x] 10. Add basic performance monitoring
  - Track core metrics: story_match_latency_ms, story_start_latency_ms, tts_time_to_first_chunk_ms
  - Implement counters: story_selected, story_skipped_no_match, story_play_success, story_play_failed, story_fallback_tts
  - Add monitoring for 2-second story loading timeout compliance
  - Create basic performance dashboard for debugging
  - Add canary test in CI for TTS p50 start ≤ 600ms when no story chosen
  - _Requirements: 8.1, 8.2, 8.6_

- [x] 11. Create end-to-end test suite
  - Write unit tests for trigger matching (exact keyword hit verification)
  - Create integration test: trigger → play → resume TTS flow
  - Add E2E test asserting no audio gap when falling back to TTS
  - Create dev performance harness (20 story attempts, print p50/p95)
  - Manual checklist for iOS Safari (gesture unlock, single preload)
  - _Requirements: 8.1, 8.2, 8.4_

## Phase 2: Robustness & Polish

- [x] 12. Add mobile optimization and resource management
  - Implement conservative preloading (max 1 decoded story on iOS)
  - Add memory management for audio buffers with 15MB cache limit
  - Only preload on user gesture unlocked AudioContext
  - When TTS is buffering, do not preload story
  - Test story system on iOS Safari and Android Chrome browsers
  - _Requirements: 7.1, 7.2, 8.7_

- [x] 13. Upgrade concurrency handling
  - Implement story queue (max 1 pending story)
  - New trigger replaces queued story but never interrupts current playback
  - Add predictable concurrency behavior with proper logging
  - Create tests for concurrent story trigger scenarios
  - Update performance monitoring for queued stories
  - _Requirements: 3.6, 4.6_

- [x] 14. Complete API endpoints and authorization
  - Add PUT /api/stories/:id for story updates and status changes
  - Implement DELETE /api/stories/:id for story removal
  - Add rate limiting on story triggers (5 triggers per session per 10 min)
  - Enhance authorization checks and security validation
  - Create comprehensive API documentation
  - _Requirements: 1.2, 5.1_

- [x] 15. Build story editor UI and enhanced management
  - Add StoryEditor component for updating story details and triggers
  - Implement priority-based story selection in UI
  - Create advanced trigger management interface
  - Add story usage analytics display for creators
  - Implement bulk story management operations
  - _Requirements: 1.2, 2.1, 2.2_

- [x] 16. Add story analytics and usage insights
  - Implement story trigger frequency tracking and analytics
  - Create usage reports for story effectiveness and engagement
  - Add story performance metrics dashboard
  - Track story success rates and user satisfaction
  - Create admin dashboard for story usage monitoring
  - _Requirements: 5.2, 5.4_

- [x] 17. Integrate with avatar lip-sync system (experimental, off by default)
  - Attempt integration with HeyGen avatar lip-sync for story audio
  - Implement fallback to idle animation when lip-sync unavailable
  - Add configuration option to enable/disable lip-sync attempts
  - Create smooth transitions between story audio and TTS lip-sync
  - Label as experimental feature with graceful degradation
  - _Requirements: 3.2, 7.4_

- [-] 18. Final integration testing and deployment preparation
  - Conduct end-to-end testing of complete story system
  - Verify performance requirements (trigger matching <100ms, loading <2s)
  - Test story system with existing expression overlays and TTS pipeline
  - Validate mobile device compatibility and resource usage
  - Create deployment checklist and rollback procedures with feature flags
  - _Requirements: 8.1, 8.2, 8.4, 8.8_

## Definition of Done (MVP)

- Creator can upload up to 5 MP3 stories (30s–5m), set triggers
- On keyword hit, TTS is replaced by story; if load >2s, TTS proceeds
- Works on desktop Chrome and iOS Safari with a single user gesture
- TTS responsiveness unchanged when no story triggers
- Metrics show p50/p95 for TTS start and story start; basic dashboards exist
- Feature flags allow instant rollback