# Requirements Document

## Introduction

The jonathan-demo factbook architecture feature transforms the current memory pipeline into a clean, Apple-like system that prioritizes speed, accuracy, and crispness. The system will use a canonical JSON factbook loaded at server boot, with lightweight in-memory indexing for instant responses. The architecture ensures sub-300ms fast lane responses and ~1s deep lane completion while eliminating hallucination and topic drift through strict factbook-only responses.

## Requirements

### Requirement 1

**User Story:** As a user interacting with the jonathan-demo, I want instant responses that feel as crisp and immediate as an Apple product, so that the conversation flows naturally without noticeable delays.

#### Acceptance Criteria

1. WHEN a user sends a message THEN the fast lane SHALL respond in <300ms with a 1-2 sentence hook
2. WHEN the fast lane responds THEN ElevenLabs TTS streaming SHALL start immediately without waiting for deep lane
3. WHEN the deep lane activates THEN it SHALL complete within ~1s total from user input
4. WHEN processing queries THEN there SHALL be no database roundtrips in the hot path
5. WHEN the system boots THEN the factbook SHALL be loaded once into memory for O(1) access

### Requirement 2

**User Story:** As a user asking questions about Jonathan, I want all answers to come directly from verified facts, so that I never receive hallucinated or invented information.

#### Acceptance Criteria

1. WHEN the system responds THEN all factual content SHALL come exclusively from jonathan_profile.json
2. WHEN no relevant facts exist in the factbook THEN the system SHALL acknowledge the limitation rather than invent details
3. WHEN building responses THEN the system SHALL never combine facts in ways not explicitly supported by the factbook
4. WHEN the factbook is corrupt or invalid THEN the system SHALL fail gracefully with a clear error message
5. WHEN logging responses THEN the system SHALL track which factbook snippets were used for each answer

### Requirement 3

**User Story:** As a user asking about specific topics like "Olive" or "Austin", I want responses to stay precisely on-topic without drifting to unrelated subjects, so that conversations remain focused and relevant.

#### Acceptance Criteria

1. WHEN a user asks "Tell me about Olive" THEN the response SHALL include Puerto Rican street dog, Maine winter, buried in Texas facts and SHALL NOT include any political content
2. WHEN a user asks "When did you live in Austin" THEN the response SHALL include 2009-2018 timeframe and SHALL NOT drift to unrelated Austin topics
3. WHEN a user asks "Tell me about Tyler" THEN the response SHALL include Austin friend traits and SHALL NOT include unrelated personal details
4. WHEN processing queries THEN the system SHALL use topic fences (pets, people, places, etc.) to prevent cross-contamination
5. WHEN selecting snippets THEN the system SHALL limit to ≤3 relevant snippets to maintain focus

### Requirement 4

**User Story:** As a user experiencing the jonathan-demo, I want the fast and deep lanes to work together seamlessly, so that I get immediate engagement followed by rich detail without repetition.

#### Acceptance Criteria

1. WHEN the fast lane responds THEN it SHALL provide the best 1-2 sentence hook capped at ~160 characters
2. WHEN the deep lane activates THEN it SHALL receive the same snippets plus the hook with coordination rules
3. WHEN the deep lane generates content THEN it SHALL NOT repeat the hook content
4. WHEN the deep lane responds THEN it SHALL build 1-3 extra sentences with details only from the provided snippets
5. WHEN checking for repetition THEN the system SHALL apply n-gram overlap check (≤30%) before streaming deep tokens

### Requirement 5

**User Story:** As a developer maintaining the system, I want a lightweight in-memory index that provides fast query resolution, so that the system remains performant and scalable.

#### Acceptance Criteria

1. WHEN the server boots THEN it SHALL build a flattened path → snippet text index with snippets ≤400 characters
2. WHEN indexing content THEN it SHALL create a simple keyword map (token → paths) for O(m) query resolution
3. WHEN processing queries THEN the lightAnalyze() helper SHALL extract obvious entities/keywords in <10ms
4. WHEN mapping keywords THEN the system SHALL map to ≤3 relevant snippets from the factbook
5. WHEN the index is built THEN retrieval SHALL be O(n) at boot and O(m) at query where m < 10ms

### Requirement 6

**User Story:** As a developer debugging the system, I want comprehensive logging and monitoring, so that I can track performance and identify issues quickly.

#### Acceptance Criteria

1. WHEN processing requests THEN the system SHALL log t_hook_ms, t_deep_first_token_ms, and t_deep_done_ms
2. WHEN selecting content THEN the system SHALL log which snippets were selected for each response
3. WHEN queries are processed THEN the system SHALL log keyword extraction results and mapping decisions
4. WHEN errors occur THEN the system SHALL provide detailed context about factbook state and query processing
5. WHEN performance degrades THEN the logging SHALL provide sufficient data to identify bottlenecks

### Requirement 7

**User Story:** As a user interacting with the jonathan-demo, I want responses that maintain Jonathan's authentic voice and personality while keeping facts and style clearly separated, so that personality never introduces hallucinated content.

#### Acceptance Criteria

1. WHEN generating responses THEN the system SHALL use the system prompt "You are Jonathan Braden. Never break character."
2. WHEN providing factual content THEN it SHALL come strictly from factbook snippets with no personality-driven additions
3. WHEN applying personality THEN it SHALL be a style layer applied after facts are selected, never during fact selection
4. WHEN asked for opinions THEN the system SHALL respond in character while clearly indicating when content is opinion vs. factbook fact
5. WHEN no factbook content applies THEN the system SHALL respond in character while explicitly acknowledging the limitation

### Requirement 8

**User Story:** As a developer implementing this system, I want clear architectural constraints that ensure the system remains fast and reliable, so that the Apple-like experience is maintained.

#### Acceptance Criteria

1. WHEN implementing retrieval THEN it SHALL be O(n) at boot and O(m) at query with m < 10ms
2. WHEN processing fast lane THEN it SHALL never block on model or database operations
3. WHEN fast lane hook is emitted THEN ElevenLabs streaming SHALL start immediately even if deep lane fails
4. WHEN the factbook exceeds reasonable size limits THEN the system SHALL provide clear guidance on factbook optimization
5. WHEN under load THEN the system SHALL maintain sub-300ms fast lane and ~1s deep lane performance targets

### Requirement 9

**User Story:** As a developer maintaining the system, I want comprehensive regression tests with golden outputs, so that I can ensure the system never drifts back into hallucination or topic drift issues.

#### Acceptance Criteria

1. WHEN test queries are run THEN regression tests SHALL verify responses match expected snippets with no hallucination or drift
2. WHEN "Tell me about Olive" is tested THEN it SHALL include Puerto Rican street dog, Maine winter, buried in Texas and SHALL NOT include political content
3. WHEN "When did you live in Austin" is tested THEN it SHALL include 2009-2018 timeframe and SHALL NOT drift to unrelated topics
4. WHEN "Tell me about Tyler" is tested THEN it SHALL include Austin friend traits and SHALL NOT include unrelated personal details
5. WHEN performance metrics are collected THEN CI SHALL fail if t_hook_ms > 300ms or t_deep_done_ms > 1000ms