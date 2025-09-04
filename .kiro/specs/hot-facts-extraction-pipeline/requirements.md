# Requirements Document

## Introduction

The Hot Facts Extraction & Persona Pipeline is an automated system designed to extract, store, and inject key identity facts for multi-user avatars in EchoStone. This system addresses the current issue where persona builders sometimes hallucinate when memory retrieval misses important facts, by creating a "hot tier" of essential identity information that is always available during avatar interactions.

The system will automatically process avatar seed text and memory fragments to extract canonical facts (birth year, birthplace, relationships, etc.), store them in a lightweight quick_facts table, and ensure these facts are always injected at the top of system prompts to prevent contradictions and maintain consistency across all avatar interactions.

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want a dedicated hot facts storage schema, so that key identity facts can be stored separately from general memories for fast retrieval.

#### Acceptance Criteria

1. WHEN the system is deployed THEN a `public.quick_facts` table SHALL exist with columns: id (uuid), avatar_id (uuid), key (text), value (text)
2. WHEN facts are stored THEN the system SHALL enforce unique constraint on (avatar_id, key) pairs
3. WHEN an avatar is deleted THEN all associated quick_facts SHALL be automatically deleted via cascade
4. WHEN querying facts THEN the system SHALL use an optimized index on avatar_id for fast lookups
5. WHEN accessing facts THEN Row Level Security SHALL allow public read access but restrict writes to service-level operations

### Requirement 2

**User Story:** As a developer, I want an automated fact extraction system, so that key identity information is captured without manual curation.

#### Acceptance Criteria

1. WHEN processing text THEN the system SHALL implement Stage A pattern heuristics to extract: birth years (1900-2035), birthplaces ("born in/at"), moves ("moved to X in Y"), and relationships ("my mom/dad/etc is")
2. WHEN implementing patterns THEN the system SHALL design heuristics to be language-agnostic or easily swappable for non-English avatar support
3. WHEN heuristics are insufficient THEN the system SHALL optionally use Stage B LLM refinement to extract additional facts with confidence markers
4. WHEN extracting facts THEN the system SHALL normalize data to standard formats (ISO years, consistent location names)
5. WHEN facts are extracted THEN the system SHALL output structured key-value pairs for: full_name, birth_year, birthplace, current_city, grew_up, moved_to__<city>__year, languages, pets_current, partner_name, family_parents, signature_style
6. WHEN processing fails THEN the system SHALL gracefully handle errors and continue with partial extraction results without blocking avatar creation or memory insertion

### Requirement 3

**User Story:** As an avatar creator, I want seamless fact extraction during avatar creation and memory addition, so that my avatar's identity facts are automatically captured and maintained.

#### Acceptance Criteria

1. WHEN creating an avatar with seed text THEN the system SHALL automatically extract facts and store them in quick_facts
2. WHEN adding new memories THEN the system SHALL incrementally extract new facts and update existing ones
3. WHEN processing memories THEN the system SHALL split seed text into 1-3 sentence fragments and store them in memory_fragments
4. WHEN extraction completes THEN the system SHALL return counts of extracted facts and created fragments
5. WHEN multiple users create avatars THEN the system SHALL ensure complete isolation between avatar data using avatar_id scoping

### Requirement 4

**User Story:** As an avatar user, I want consistent and grounded responses, so that my avatar never contradicts established facts or hallucinates missing information.

#### Acceptance Criteria

1. WHEN generating responses THEN the system SHALL always fetch quick_facts first before other context sources including short-term conversation memory
2. WHEN building prompts THEN the system SHALL inject authoritative facts at the top of the system prompt
3. WHEN including memories THEN the system SHALL limit memory injection to top 5-8 fragments by relevance score to manage token budget
4. WHEN facts are missing THEN the system SHALL explicitly state "I don't have that yet" rather than guessing
5. WHEN answering factual questions THEN the system SHALL cite only verified facts from quick_facts or memory search results
6. WHEN prompt size limits are reached THEN the system SHALL prioritize quick_facts over general memories and conversation history

### Requirement 5

**User Story:** As a developer, I want debugging and monitoring capabilities, so that I can verify the system is working correctly and troubleshoot issues.

#### Acceptance Criteria

1. WHEN debugging persona building THEN the system SHALL provide GET /api/debug/persona?avatar=slug endpoint returning quick facts count, traits count, and top memories preview
2. WHEN inspecting facts THEN the system SHALL provide GET /api/debug/facts?avatar=slug endpoint returning current quick_facts dump
3. WHEN testing search THEN the system SHALL provide GET /api/debug/search?avatar=slug&q=term endpoint returning search results with scores
4. WHEN accessing debug endpoints THEN the system SHALL restrict access to development environments only
5. WHEN debugging THEN each endpoint SHALL return structured JSON with clear field names and data types

### Requirement 6

**User Story:** As a system user, I want reliable avatar creation and memory management APIs, so that I can programmatically manage avatar data.

#### Acceptance Criteria

1. WHEN creating avatars THEN POST /api/avatars SHALL accept {slug, display_name?, seed_text?} and return avatar details with fact counts
2. WHEN adding memories THEN POST /api/avatars/:slug/memories SHALL accept {fragments: string[]} and return processing counts
3. WHEN API calls fail THEN the system SHALL return appropriate HTTP status codes and error messages
4. WHEN fact extraction fails THEN the system SHALL continue with avatar creation or memory insertion and log extraction errors for debugging
5. WHEN processing large seed texts THEN the system SHALL handle requests within reasonable time limits (< 30 seconds)
6. WHEN concurrent requests occur THEN the system SHALL maintain data consistency using proper transaction isolation

### Requirement 7

**User Story:** As a quality assurance tester, I want comprehensive test scenarios, so that I can verify the system works correctly across different use cases.

#### Acceptance Criteria

1. WHEN testing basic extraction THEN the system SHALL correctly extract birth year, birthplace, and move information from sample seed text
2. WHEN testing avatar interactions THEN responses SHALL cite extracted facts accurately without hallucination
3. WHEN testing follow-up questions THEN the system SHALL maintain context using short-term conversation memory and provide consistent answers
4. WHEN testing missing information THEN the system SHALL explicitly state when facts are unavailable
5. WHEN testing edge cases THEN the system SHALL handle malformed input, empty seed text, and extraction failures gracefully

### Requirement 8

**User Story:** As a system architect, I want scalable performance, so that the system can handle hundreds of avatars and thousands of memory fragments efficiently.

#### Acceptance Criteria

1. WHEN the system scales THEN quick_facts queries SHALL complete in under 100ms for individual avatars
2. WHEN processing multiple avatars THEN the system SHALL maintain isolation and prevent cross-avatar data leakage
3. WHEN storing facts THEN the system SHALL use efficient indexing to support fast lookups by avatar_id
4. WHEN memory usage grows THEN the system SHALL maintain reasonable prompt sizes under token budget limits
5. WHEN concurrent operations occur THEN the system SHALL handle multiple avatar creations and updates without performance degradation

### Requirement 9

**User Story:** As a returning avatar user, I want new information I share to be remembered as part of the avatar's identity, so the avatar can recall it naturally in future conversations without relying on random memory search hits.

#### Acceptance Criteria

1. WHEN a new conversation fragment is stored THEN the fact extraction pipeline SHALL re-run fact detection on that fragment immediately within 200ms
2. WHEN new canonical facts are detected THEN the system SHALL recognize and normalize facts for: pets_current, partner_name, current_city, family_parents, current_job, hobbies
3. WHEN facts don't exist in quick_facts THEN the system SHALL insert new facts immediately
4. WHEN facts differ from existing values THEN the system SHALL update with new values and store old values in fact_history table for traceability
5. WHEN facts are updated THEN they SHALL be injected into the next conversation's system prompt immediately for instant recall
6. WHEN large imports occur THEN the system SHALL re-scan all fragments and re-promote any missing facts
7. WHEN promotion processing occurs THEN it SHALL complete within 200ms per fragment to avoid slowing real-time conversations