# Requirements Document

## Introduction

The EchoStone MVP Slim Core feature aims to deliver a clean, fast MVP where every new avatar immediately "knows the basics" from onboarding, answers accurately, and speaks with sub-1.5s first-audio response time. This will be achieved without rebuilding existing pipelines, instead archiving experimental code and focusing on one optimized path for chat, voice, and seeding.

## Requirements

### Requirement 1

**User Story:** As a user creating a new avatar, I want the system to quickly extract and store basic identity information during onboarding, so that my avatar immediately knows essential facts about me.

#### Acceptance Criteria

1. WHEN a user completes onboarding with form data and optional free text THEN the system SHALL extract and normalize up to 17 quick fact keys including full_name, given_name, pronouns, home_city, home_country, timezone, birth_year, profession, passions, partner_name, children, parents, pets, tagline, tone_style, identity_pillars, and signature_memories
2. WHEN extracting facts from free text THEN the system SHALL use a deterministic LLM call with ≤300 tokens and low temperature plus regex fallbacks
3. WHEN storing quick facts THEN the system SHALL perform bulk upsert operations in a single database transaction for idempotency
4. WHEN onboarding is complete THEN the system SHALL log "JD_SEED {avatar_id, facts_count}" for telemetry

### Requirement 2

**User Story:** As a user chatting with my avatar, I want it to respond accurately using my basic information, so that conversations feel personal and contextually relevant.

#### Acceptance Criteria

1. WHEN the chat system builds prompts THEN it SHALL always include a compact Basics block (≤300 tokens) assembled from quick_facts
2. WHEN a user asks "Who are you?" THEN the avatar SHALL respond using full_name/given_name and profession from stored facts
3. WHEN a user asks "Where do you live?" THEN the avatar SHALL respond using home_city/home_country/timezone from stored facts
4. WHEN a user asks about pets THEN the avatar SHALL respond using specific pet information if provided during onboarding
5. WHEN retrieving facts THEN the system SHALL use the existing service Supabase client already injected in builder/chat paths

### Requirement 3

**User Story:** As a user interacting with my avatar, I want voice responses to begin within 1.5 seconds, so that conversations feel natural and responsive.

#### Acceptance Criteria

1. WHEN a user requests voice output THEN the system SHALL maintain current low-latency TTS/streaming behavior
2. WHEN generating voice responses THEN the first audio SHALL begin within 1.5 seconds using /api/voice-stream
3. WHEN processing voice requests THEN the system SHALL use optimized facts retrieval to minimize pre-TTS processing time

### Requirement 4

**User Story:** As a developer debugging avatar issues, I want a single consolidated debug endpoint, so that I can quickly assess avatar state without multiple API calls.

#### Acceptance Criteria

1. WHEN accessing the debug endpoint THEN it SHALL require DEBUG_SECRET header for security
2. WHEN querying by avatarSlug or profileName THEN the system SHALL return avatar_id, quick_facts_count, sample_keys, mem_count_last_24h, and last_3_mems
3. WHEN the debug endpoint is called THEN it SHALL use the resolveAvatarId service and service client for data retrieval

### Requirement 5

**User Story:** As a developer maintaining the codebase, I want experimental and duplicate code archived rather than deleted, so that we preserve development history while focusing on core functionality.

#### Acceptance Criteria

1. WHEN archiving code THEN the system SHALL use git-move to preserve commit history
2. WHEN archiving endpoints THEN duplicate chat APIs, voice experiments, and dev/debug/test endpoints SHALL be moved to archive/ directory
3. WHEN archiving components THEN streaming tests, voice previews, and debug components SHALL be moved to archive/ directory
4. WHEN archiving libraries THEN unused memory services, voice services, and audio managers SHALL be moved to archive/ directory
5. WHEN archiving is complete THEN the main codebase SHALL contain only one chat path, one voice path, and one seed path

### Requirement 6

**User Story:** As a developer working with avatar data, I want consistent avatar ID resolution across all services, so that data operations are reliable and standardized.

#### Acceptance Criteria

1. WHEN resolving avatar IDs THEN the system SHALL try avatar_profiles.name first, fallback to avatars.slug, and return avatar_id
2. WHEN any service needs avatar ID resolution THEN it SHALL use the centralized resolveAvatarId function
3. WHEN avatar ID resolution fails THEN the system SHALL handle errors gracefully and provide meaningful feedback

### Requirement 7

**User Story:** As a user, I want the onboarding process to provide clear feedback when my basic information is successfully captured, so that I know the system is ready for conversations.

#### Acceptance Criteria

1. WHEN onboarding form is submitted THEN the system SHALL call /api/onboarding/seed endpoint
2. WHEN seed operation completes successfully THEN the UI SHALL show a "Basics ready" checkmark
3. WHEN seed operation returns THEN it SHALL include avatar_id, facts_upserted count, and summary_id in response

### Requirement 8

**User Story:** As a system administrator, I want the application to build and type-check successfully after changes, so that the MVP maintains code quality and deployability.

#### Acceptance Criteria

1. WHEN running build process THEN pnpm build SHALL complete without errors
2. WHEN running type checking THEN pnpm typecheck SHALL pass without type errors
3. WHEN manual testing is performed THEN creating new avatar, first chat responses, voice generation, and debug endpoint SHALL all function correctly