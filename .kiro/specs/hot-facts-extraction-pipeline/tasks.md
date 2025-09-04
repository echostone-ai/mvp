# Implementation Plan

- [x] 1. Create database schema and migrations
  - Create SQL migration for quick_facts table with priority, date_context, and expiration fields
  - Create SQL migration for fact_history table for change tracking
  - Add proper indexes for performance (avatar_id, priority, key)
  - Set up Row Level Security policies for public read access
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement core fact extraction engine
- [x] 2.1 Create pattern heuristics extractor
  - Write PatternExtractor class with methods for birth year, birthplace, moves, relationships
  - Add language-agnostic pattern support for international users
  - Implement normalization functions for dates, locations, and names
  - Create unit tests for all pattern extraction methods
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 2.2 Implement LLM refinement engine
  - Create LLMExtractor class with OpenAI integration for fact refinement
  - Design prompt template for structured fact extraction with confidence scores
  - Add validation logic for extracted facts (year ranges, format checks)
  - Implement confidence calculation and fact filtering
  - Create unit tests for LLM extraction and validation
  - _Requirements: 2.3, 2.5_

- [x] 2.3 Build fact extraction orchestrator
  - Create FactExtractionEngine that coordinates pattern and LLM extraction
  - Implement error handling and graceful degradation when extraction fails
  - Add processing time tracking and performance monitoring
  - Create integration tests for full extraction pipeline
  - _Requirements: 2.5, 2.6_

- [x] 3. Implement real-time fact promotion system
- [x] 3.1 Create fact promotion engine
  - Build FactPromotionEngine for processing new conversation fragments
  - Implement detectPromotableFacts method for real-time fact detection
  - Add updateOrInsertFact method with conflict resolution logic
  - Create archiveOldFact method for change history tracking
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 3.2 Add database triggers for automatic promotion
  - Create database trigger on memory_fragments insert to queue fact promotion
  - Implement background job processing for fact promotion within 200ms target
  - Add error handling and retry logic for failed promotions
  - Create monitoring for promotion performance and success rates
  - _Requirements: 9.1, 9.7_

- [x] 4. Update avatar creation and memory APIs
- [x] 4.1 Enhance avatar creation endpoint
  - Modify POST /api/avatars to accept seed_text parameter
  - Integrate fact extraction into avatar creation flow
  - Split seed text into memory fragments and store in memory_fragments table
  - Return extraction results including fact counts and processing time
  - Add comprehensive error handling that doesn't block avatar creation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.4_

- [x] 4.2 Enhance memory addition endpoint
  - Modify POST /api/avatars/:slug/memories to trigger incremental fact extraction
  - Implement batch processing for multiple memory fragments
  - Add fact promotion integration for real-time updates
  - Return processing statistics and extraction results
  - Ensure multi-tenant safety with proper avatar_id scoping
  - _Requirements: 3.2, 3.5, 6.2, 9.5_

- [ ] 5. Build enhanced prompt builder with fact injection
- [x] 5.1 Create priority-based fact retrieval
  - Implement fetchQuickFacts method with priority filtering (1=highest, 10=lowest)
  - Create fetchStyleProfile method for speaking style and personality traits
  - Add fact expiration handling to exclude outdated information
  - Optimize database queries for sub-100ms retrieval performance
  - _Requirements: 4.1, 4.3, 8.1_

- [ ] 5.2 Implement structured prompt building
  - Create new prompt template with core identity, style, and life context sections
  - Implement fact formatting with priority-based organization
  - Add memory limit enforcement (top 5-8 fragments) for token budget management
  - Include conversation history integration with short-term memory
  - Add source reference injection for fact provenance
  - _Requirements: 4.2, 4.3, 4.4, 4.6_

- [x] 5.3 Add guardrails for missing information
  - Implement "I don't have that yet" responses for missing facts
  - Add fact validation to prevent contradictions with established information
  - Create consistency checking between quick_facts and memory search results
  - Add logging for fact gaps and potential hallucination attempts
  - _Requirements: 4.4, 4.5_

- [x] 6. Create debug and monitoring endpoints
- [x] 6.1 Implement persona debug endpoint
  - Create GET /api/debug/persona?avatar=slug endpoint
  - Return quick facts count, traits count, and top memories preview
  - Add processing time metrics and extraction statistics
  - Restrict access to development environments only
  - _Requirements: 5.1, 5.4_

- [x] 6.2 Implement facts inspection endpoint
  - Create GET /api/debug/facts?avatar=slug endpoint
  - Return complete quick_facts dump with priority and confidence scores
  - Include fact history and change tracking information
  - Add filtering options by priority, confidence, and date ranges
  - _Requirements: 5.2, 5.5_

- [x] 6.3 Implement search testing endpoint
  - Create GET /api/debug/search?avatar=slug&q=term endpoint
  - Return search_memories results with relevance scores
  - Include quick_facts matching and memory fragment analysis
  - Add performance timing and result quality metrics
  - _Requirements: 5.3, 5.5_

- [x] 7. Add comprehensive error handling and monitoring
- [ ] 7.1 Implement extraction error recovery
  - Create ErrorHandler class for pattern failures, LLM failures, and storage failures
  - Add graceful degradation that continues avatar creation even with extraction failures
  - Implement retry logic for transient failures with exponential backoff
  - Add comprehensive logging for debugging extraction issues
  - _Requirements: 2.6, 6.4_

- [ ] 7.2 Add performance monitoring and metrics
  - Create ExtractionMetrics interface for tracking success rates and processing times
  - Implement database performance monitoring for quick_facts queries
  - Add alerting for extraction failures and performance degradation
  - Create dashboards for fact extraction pipeline health
  - _Requirements: 8.1, 8.5_

- [ ] 8. Create comprehensive test suite
- [ ] 8.1 Write unit tests for extraction components
  - Test pattern extraction with various text formats and edge cases
  - Test LLM integration with mock responses and error scenarios
  - Test fact normalization and validation logic
  - Test priority assignment and confidence calculation
  - _Requirements: 7.1, 7.5_

- [ ] 8.2 Write integration tests for API endpoints
  - Test avatar creation with seed text containing known facts
  - Test memory addition with incremental fact extraction
  - Test fact promotion from conversation fragments
  - Test multi-user isolation and data scoping
  - _Requirements: 7.1, 7.2, 8.2_

- [ ] 8.3 Write end-to-end acceptance tests
  - Test avatar responses cite extracted facts accurately without hallucination
  - Test follow-up questions maintain consistency using conversation memory
  - Test missing information responses with "I don't have that yet" messaging
  - Test fact updates and change history tracking
  - _Requirements: 7.2, 7.3, 7.4_

- [ ] 8.4 Write performance and load tests
  - Test 100 concurrent avatar creations with 1KB seed text each
  - Test quick_facts retrieval under 100ms for 1000 avatars
  - Test fact promotion processing under 200ms per fragment
  - Test database performance with 10,000 avatars and 100,000 facts
  - _Requirements: 8.1, 8.3, 8.4, 8.5, 9.7_

- [ ] 9. Create documentation and deployment guides
- [ ] 9.1 Write API documentation
  - Document all new endpoints with request/response schemas
  - Create usage examples for avatar creation and memory management
  - Document debug endpoints and monitoring capabilities
  - Add troubleshooting guide for common extraction issues
  - _Requirements: 6.3_

- [ ] 9.2 Create deployment and migration guide
  - Write step-by-step database migration instructions
  - Create configuration guide for LLM integration and API keys
  - Document performance tuning recommendations
  - Add monitoring and alerting setup instructions
  - _Requirements: 1.1_

- [ ] 10. Integration testing with existing system
- [ ] 10.1 Test integration with existing search_memories function
  - Verify quick_facts injection doesn't break existing memory search
  - Test combined fact and memory retrieval in prompt building
  - Ensure backward compatibility with existing avatar interactions
  - Validate performance impact on existing API endpoints
  - _Requirements: 4.1, 8.1_

- [ ] 10.2 Test multi-avatar and multi-user scenarios
  - Verify complete data isolation between different avatars
  - Test concurrent fact extraction across multiple users
  - Validate RLS policies prevent cross-avatar data access
  - Test system performance under realistic multi-user load
  - _Requirements: 3.5, 8.2, 8.5_