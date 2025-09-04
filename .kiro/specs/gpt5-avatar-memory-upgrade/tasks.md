# Implementation Plan

- [ ] 1. Create GPT-5 integration service with structured context handling
  - Implement GPT5Service class with generateResponse method that accepts StructuredContext
  - Add response validation and confidence scoring
  - Create error handling for API failures with fallback to GPT-4
  - Write unit tests for GPT-5 API integration and response processing
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. Build database schema compatibility layer
  - Create SchemaCompatibilityLayer class to resolve table name mappings (avatars → avatar_profiles)
  - Implement column name validation and query qualification methods
  - Add constraint validation for fact_history inserts with proper change_source values
  - Implement automated schema verification during deployment to catch and resolve any legacy table/column references (avatars → avatar_profiles) before they break context retrieval, including alerting if any unknown table or column is referenced
  - Write tests to verify all database queries work with current schema
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Implement context retrieval engine with ordered data merging
  - Create ContextRetrievalEngine class that fetches quick_facts, memory_fragments, and conversation history
  - Implement ordered context merging: quick_facts → memory_fragments → conversation history
  - Add confidence-based filtering to avoid low-confidence facts unless no alternatives exist
  - Create query optimization for performance targeting <500ms retrieval time
  - Write tests for context retrieval and merging logic
  - _Requirements: 2.1, 2.2, 4.4, 7.1_

- [x] 4. Create memory injection template system
  - Implement MemoryInjectionTemplate class with structured context formatting
  - Design template structure with core identity, contextual facts, memories, and conversation history sections
  - Add template validation and model-specific optimization methods
  - Create consistent formatting to reduce GPT-5 hallucination
  - Write tests for template generation and validation
  - _Requirements: 3.2, 3.5_

- [x] 5. Build automatic memory update pipeline
  - Create MemoryUpdatePipeline class for extracting facts from conversations
  - Implement automatic fact extraction with confidence scoring and priority assignment
  - Add conflict resolution logic that chooses highest confidence and priority values
  - Create session memory merging that automatically persists new information unless marked to ignore
  - Write tests for fact extraction and conflict resolution
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 2.5_

- [x] 6. Implement enhanced conversation service with GPT-5 integration
  - Create ConversationService that orchestrates context retrieval, GPT-5 processing, and memory updates
  - Integrate all components: context retrieval → memory injection → GPT-5 → memory updates
  - Add conversation continuity tracking within sessions
  - Ensure ConversationService maintains session-level entity binding for core facts (pets, names, relationships) so that once a fact exists in quick_facts or conversation history, GPT-5 treats it as truth for the entire session unless explicitly overridden, working across both fast and full context modes
  - Implement performance monitoring to meet <1.5s text and <3s TTS targets
  - Write integration tests for complete conversation flow
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.3, 2.4, 7.3_

- [x] 7. Create fast-mode optimization for sub-200ms responses
  - Implement caching layer for frequently accessed quick_facts with 30-second TTL
  - Add parallel data retrieval for facts, memories, and history
  - Create selective loading based on query analysis to minimize database hits
  - Optimize memory fragment queries to skip for simple queries
  - Write performance tests to validate speed improvements
  - _Requirements: 7.1, 7.2, 7.4_

- [x] 8. Build conversation history management system
  - Create ConversationSession class to track turns and context within sessions
  - Implement conversation history storage and retrieval with proper visitor ID handling
  - Add automatic cleanup of old conversation data
  - Create session state persistence for multi-turn conversations
  - Write tests for conversation history tracking and retrieval
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 9. Implement fact confidence and priority scoring system
  - Create FactScoringService to assign confidence and priority values to extracted facts
  - Implement source reliability scoring (manual > extraction > llm > heuristic)
  - Add recency bonus for newer information in conflict resolution
  - Create confidence threshold enforcement (avoid facts below 0.35, 0.25 for place facts)
  - Write tests for scoring algorithms and threshold enforcement
  - _Requirements: 4.3, 4.4_

- [x] 10. Create error handling and graceful degradation system
  - Implement graceful fallbacks for context retrieval failures using cached data
  - Add retry logic with exponential backoff for GPT-5 API failures
  - Create queue system for failed memory updates with retry mechanism
  - Implement in-memory cache fallback for database connection issues
  - Write tests for error scenarios and fallback behavior
  - _Requirements: 5.5, 7.5_

- [x] 11. Build comprehensive testing suite
  - Create unit tests for all service classes and their methods
  - Implement integration tests for end-to-end conversation flows
  - Add performance benchmarks for response time targets
  - Create accuracy tests for fact recall and context continuity
  - Write database compatibility tests for schema changes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 12. Integrate with existing avatar onboarding system
  - Update avatar creation flow to immediately store setup information in quick_facts
  - Ensure onboarding data is available in both quick_facts and pre-injected context for the first conversation, so GPT-5 immediately answers as if it already knows these details, without asking redundant questions
  - Add validation that setup facts are properly categorized and prioritized
  - Create seamless transition from setup to conversation mode
  - Write tests for onboarding integration and immediate fact availability
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 13. Create monitoring and analytics system
  - Implement response time monitoring with alerts for performance degradation
  - Add fact recall accuracy tracking to measure system effectiveness
  - Create conversation quality metrics and user satisfaction indicators
  - Build system health dashboard for monitoring database performance and API usage
  - Write tests for monitoring data collection and alert systems
  - _Requirements: 7.3, 7.4, 7.5_

- [ ] 14. Update existing API endpoints to use new GPT-5 system
  - Modify /api/reply-fast route to use new ConversationService
  - Update /api/chat route to integrate GPT-5 conversation flow
  - Ensure backward compatibility with existing client applications
  - Add feature flags for gradual rollout of GPT-5 integration
  - Write tests for API endpoint functionality and backward compatibility
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 15. Optimize database queries and add performance monitoring
  - Review and optimize all database queries for performance
  - Add database connection pooling and query result caching
  - Create indexes for new query patterns introduced by GPT-5 system
  - Implement query performance monitoring and slow query alerts
  - Write tests for database performance and optimization effectiveness
  - _Requirements: 7.1, 7.2, 7.4, 7.5_