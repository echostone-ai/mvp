# Requirements Document

## Introduction

This feature extends the EchoStone avatar system to support longer personal stories (2-5 minutes) played in the user's authentic recorded voice rather than synthetic ElevenLabs TTS. These "super-expressions" will allow avatars to share meaningful personal narratives when triggered by relevant conversation topics, creating a more intimate and authentic user experience while maintaining seamless integration with the existing expression and animation pipeline.

## Requirements

### Requirement 1

**User Story:** As an avatar creator, I want to upload and manage personal story recordings so that my avatar can share authentic voice narratives with visitors.

#### Acceptance Criteria

1. WHEN a user accesses the story management interface THEN the system SHALL provide options to upload audio files up to 10MB in size
2. WHEN uploading a story THEN the system SHALL accept MP3 format audio files with duration between 30 seconds and 5 minutes
3. WHEN creating a story entry THEN the system SHALL require a title, category selection, and trigger keywords
4. WHEN saving a story THEN the system SHALL validate audio file integrity and store metadata including duration
5. IF an uploaded file exceeds size or duration limits THEN the system SHALL reject the upload with clear error messaging

### Requirement 2

**User Story:** As an avatar creator, I want to categorize my stories and define trigger keywords so that the right stories play at appropriate conversation moments.

#### Acceptance Criteria

1. WHEN creating a story THEN the system SHALL provide category options: memory, experience, advice, anecdote
2. WHEN defining triggers THEN the system SHALL allow multiple keyword/phrase entries per story
3. WHEN entering trigger keywords THEN the system SHALL support case-insensitive matching
4. WHEN managing stories THEN the system SHALL allow editing of titles, categories, triggers, and transcripts
5. WHEN viewing story lists THEN the system SHALL display stories grouped by category with trigger preview

### Requirement 3

**User Story:** As a visitor, I want authentic story playback to feel natural and seamless so that the conversation flow remains engaging without technical interruptions.

#### Acceptance Criteria

1. WHEN a conversation trigger matches a story keyword THEN the system SHALL initiate story playback within 2 seconds
2. WHEN playing an authentic story THEN the system SHOULD maintain avatar lip-sync animation synchronized to the audio
3. WHEN story playback begins THEN the system SHALL preload the audio to prevent buffering delays
4. WHEN a story completes THEN the system SHALL smoothly transition back to ElevenLabs TTS conversation
5. IF story audio fails to load THEN the system SHALL gracefully fallback to ElevenLabs TTS response

### Requirement 4

**User Story:** As a visitor, I want story playback to integrate with the existing expression system so that the avatar remains visually engaging during longer narratives.

#### Acceptance Criteria

1. WHEN playing authentic stories THEN the system SHALL use the same audio queue and caching mechanisms as expressions
2. WHEN story playback is active THEN the system SHALL disable conflicting expression overlays
3. WHEN stories play THEN the system SHALL maintain consistent audio levels with existing expression system
4. WHEN switching between story and TTS audio THEN the system SHALL prevent audio gaps or overlaps
5. WHEN multiple audio sources are queued THEN the system SHALL prioritize story playback over standard expressions
6. WHEN a story is playing and another story is triggered THEN the new story SHALL be queued unless explicitly marked as interruptible

### Requirement 5

**User Story:** As a system administrator, I want story data to be efficiently stored and retrieved so that the feature performs well at scale.

#### Acceptance Criteria

1. WHEN storing story metadata THEN the system SHALL use the existing database schema with appropriate indexing
2. WHEN matching conversation triggers THEN the system SHALL perform keyword lookups in under 100ms
3. WHEN serving story audio THEN the system SHALL implement appropriate caching strategies
4. WHEN managing storage THEN the system SHALL track total audio storage per user account
5. IF storage limits are approached THEN the system SHALL notify users and provide management options
6. WHEN managing per-avatar quotas THEN the system SHALL enforce a maximum of 20 stories per avatar to prevent database bloat

### Requirement 6

**User Story:** As an avatar creator, I want optional transcript support so that stories can be accessible and searchable (non-blocking for v1 implementation).

#### Acceptance Criteria

1. WHEN uploading a story THEN the system SHALL provide optional transcript text input
2. WHEN transcripts are provided THEN the system SHALL store them for potential caption display
3. WHEN searching stories THEN the system SHALL include transcript content in keyword matching
4. WHEN viewing story details THEN the system SHALL display transcript if available
5. WHEN transcripts exist THEN the system SHALL validate they reasonably match audio duration

### Requirement 7

**User Story:** As a visitor, I want story playback to work reliably across different devices and browsers so that the experience is consistent.

#### Acceptance Criteria

1. WHEN accessing stories on mobile devices THEN the system SHALL handle iOS/Android audio context requirements
2. WHEN playing stories in different browsers THEN the system SHALL maintain consistent audio quality and timing
3. WHEN network conditions vary THEN the system SHALL implement progressive loading for larger audio files
4. WHEN audio codec support differs THEN the system SHALL provide fallback formats if needed
5. IF device audio capabilities are limited THEN the system SHALL gracefully degrade while maintaining functionality

### Requirement 8

**User Story:** As a product owner, I want super-expressions to have zero negative impact on normal conversation responsiveness so that users continue to experience sub-second TTS start times and smooth playback.

#### Acceptance Criteria

1. WHEN no story is selected THEN time-to-first-audio-chunk for ElevenLabs streaming SHALL remain ≤ 600ms p50 / ≤ 900ms p95
2. WHEN story matching runs and returns no match THEN TTS start time SHALL complete within ≤ 100ms p95
3. WHEN keyword matching executes THEN it SHALL use indexed queries completing ≤ 100ms p95
4. WHEN a story is selected THEN first audible frame SHALL start ≤ 2.0s p95 from selection
5. WHEN TTS is actively buffering THEN story preloads SHALL NOT occur simultaneously
6. WHEN story load fails or exceeds 2s SLA THEN system SHALL abandon story and start TTS with no gap > 150ms
7. WHEN stories are enabled THEN CPU overhead SHALL be ≤ 3% p95 on mid-range mobile during normal chat
8. WHEN caching stories THEN client SHALL keep max 2 recent stories per avatar with ≤ 30MB total cache budget