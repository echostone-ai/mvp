# Implementation Plan

- [x] 1. Set up database schema and feature flag infrastructure
  - Create expression_clips table with simplified schema (owner_type, owner_key, type, tone, hints, cdn_url, duration_ms, priority, status)
  - Add FEATURE_VOICE_OVERLAYS environment variable support across API routes
  - Create database migration file for expression tables
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 2. Implement core expression upload API
  - Create /api/expressions/upload endpoint with file validation (5MB max, audio formats)
  - Implement basic audio processing: trim silence, apply fade in/out, encode to mp3 22.05kHz mono
  - Add file upload to Supabase storage bucket with CDN URL generation
  - Store expression metadata in database with calculated duration_ms
  - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Create expression management API endpoints
  - Implement GET /api/expressions endpoint with owner filtering (user vs avatar)
  - Add PATCH /api/expressions/[id] for updating status and metadata
  - Create DELETE /api/expressions/[id] for removing expressions
  - Add proper error handling and feature flag gating for all endpoints
  - _Requirements: 4.2, 4.3, 8.1, 8.2_

- [ ] 4. Build basic expression upload UI component
  - Create ExpressionUploader component with drag-and-drop file support
  - Add expression type dropdown (laugh, sigh, breath, affirmation, greeting, catchphrase, filler)
  - Implement tone and placement hints input fields
  - Add upload progress indicator and success/error feedback
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 5. Implement expression list management UI
  - Create ExpressionList component showing user's uploaded expressions
  - Add preview playback functionality for each expression
  - Implement activate/deactivate toggle for expressions
  - Add delete functionality with confirmation dialog
  - _Requirements: 1.6, 1.5_

- [x] 6. Create useExpressionPack hook for client runtime
  - Implement hook to load and preload expression audio buffers
  - Add automatic preloading on user gesture (first interaction)
  - Handle feature flag gating and graceful fallback when disabled
  - Cache loaded buffers and manage memory cleanup
  - _Requirements: 5.1, 6.4, 8.1_

- [x] 7. Build expression overlay scheduler
  - Create scheduleOverlays function for analyzing text and selecting appropriate expressions
  - Implement simple keyword-based matching for expression types
  - Add overlay timing calculation with 4-second minimum spacing
  - Enforce maximum 2 overlays per turn limit
  - _Requirements: 5.2, 5.4_

- [x] 8. Implement Web Audio mixer for expression playback
  - Create audio mixing system that overlays expressions on TTS without blocking
  - Add 3-6dB ducking of TTS audio during expression playback
  - Ensure smooth audio blending with no clipping or harsh transitions
  - Implement graceful degradation when buffers aren't ready
  - _Requirements: 5.3, 5.5, 6.3, 9.3, 9.4_

- [x] 9. Integrate expression system with existing voice pipeline
  - Modify StreamingAudioManager to support expression overlays
  - Ensure TTS first audio timing remains unchanged (baseline performance)
  - Add expression scheduling hooks to voice runtime without blocking TTS
  - Test integration with GlobalAudioManager and GaplessPlayer
  - _Requirements: 9.1, 9.2, 5.2_

- [x] 10. Add admin expression management for jonathan-demo
  - Create admin interface for uploading expressions to specific avatars
  - Implement avatar-specific expression assignment (owner_type='avatar', owner_key='jonathan-demo')
  - Add priority system for admin expressions vs user expressions
  - Ensure demo avatars use only admin expressions, not user expressions
  - _Requirements: 2.1, 2.4, 6.2_

- [x] 11. Implement user privacy controls and settings
  - Add user setting to disable expression overlays completely
  - Implement per-session expression disable functionality
  - Ensure privacy setting is respected across all expression playback
  - Add graceful handling when expressions are disabled mid-conversation
  - _Requirements: 6.1, 6.5_

- [x] 12. Add comprehensive error handling and monitoring
  - Implement graceful degradation for network failures during expression loading
  - Add metrics tracking for overlays_count, first_audio_ms, and tts_total_ms
  - Create error logging for expression failures without breaking TTS flow
  - Add performance monitoring to ensure <300ms expression duration limit
  - _Requirements: 6.3, 6.4, 7.1, 7.2, 7.3, 9.5_

- [x] 13. Create comprehensive test suite
  - Write unit tests for expression processing (trim, fade, encode)
  - Add integration tests ensuring TTS performance is not impacted
  - Create tests for expression selection and overlay scheduling
  - Add performance tests for preloading and audio mixing
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 14. Add Voice & Expressions page to user interface
  - Create dedicated page route for expression management
  - Integrate ExpressionUploader and ExpressionList components
  - Add navigation link in user menu (feature-flagged)
  - Implement responsive design for mobile and desktop
  - _Requirements: 1.1, 8.1_

- [x] 15. Deploy and validate end-to-end functionality
  - Test complete upload-to-playback flow with real audio files
  - Validate jonathan-demo avatar expressions work in production
  - Verify feature flag controls work across all environments
  - Confirm TTS performance baseline is maintained
  - _Requirements: 8.4, 8.5, 9.1, 9.2_