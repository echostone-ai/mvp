# Requirements Document

## Introduction

Fix the expression overlay system to enable basic expression playback during TTS streaming. Focus on minimal viable implementation: one hardcoded trigger that plays one expression audio file without breaking existing TTS functionality.

## Requirements

### Requirement 1

**User Story:** As a user typing "that's funny" in jonathan-demo, I want to hear a laugh expression play alongside the TTS response, so that I can verify the overlay system works.

#### Acceptance Criteria

1. WHEN system receives exact phrase "that's funny" THEN console SHALL log "[overlay: laugh triggered]" within 200ms
2. WHEN overlay fires THEN laugh.mp3 SHALL play simultaneously with TTS stream without blocking TTS
3. WHEN no expression is available THEN only TTS SHALL play with no crash or silence
4. WHEN expressionPlayer is used THEN it SHALL be properly awaited before first use

### Requirement 2

**User Story:** As a developer testing the fix, I want clear proof the system works, so that I can verify the baseline before adding complexity.

#### Acceptance Criteria

1. WHEN testing "that's funny" input THEN both TTS audio and laugh audio SHALL be audible concurrently
2. WHEN expression triggers THEN console SHALL show timestamp and expression name
3. WHEN laugh.mp3 finishes playback THEN console SHALL log "[overlay: laugh completed]" with timestamp
4. WHEN testing multiple times THEN behavior SHALL be consistent and repeatable
5. WHEN TTS completes THEN expression audio SHALL not interfere with next TTS cycle

### Requirement 3

**User Story:** As a developer maintaining the codebase, I want minimal code changes, so that we prove the concept without over-engineering.

#### Acceptance Criteria

1. WHEN implementing THEN changes SHALL use exact keyword matching (no regex or NLP)
2. WHEN modifying code THEN focus SHALL be on streamingUtils.ts and expression player only
3. WHEN complete THEN total code diff SHALL be under 20 lines
4. WHEN overlay plays THEN no ducking or fading SHALL be implemented (concurrent audio only)
5. WHEN system fails THEN TTS SHALL continue working normally