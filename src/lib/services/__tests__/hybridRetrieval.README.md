# Hybrid Retrieval Test Suite Documentation

This directory contains a comprehensive test suite for the hybrid retrieval system, implementing task 11 from the hybrid retrieval specification.

## Test Files Overview

### Core Test Files

#### `hybridRetrieval.golden.test.ts`
The main golden query test suite containing:
- **Golden Query Set**: 12 real questions testing core functionality
- **Semantic Connection Tests**: 7 specific semantic understanding test cases
- **Performance Regression Tests**: P95 latency validation (≤600ms requirement)
- **Golden Output Validation**: Accuracy tests against known query-result pairs
- **Integration Tests**: FactbookService compatibility validation

#### `hybridRetrieval.fallback.test.ts`
Comprehensive fallback behavior testing:
- **Component Failure Scenarios**: Individual component failure handling
- **Timeout Scenarios**: Graceful degradation under time constraints
- **Cascading Failure Tests**: Multiple simultaneous component failures
- **Error Recovery**: Transient failure recovery and resilience
- **Configuration-Based Fallbacks**: Feature flag respect during failures

#### `hybridRetrieval.performance.test.ts`
Dedicated performance regression testing:
- **P95 Latency Requirements**: ≤300ms baseline, ≤600ms with all features
- **Component-Level Performance**: Individual component timing validation
- **Caching Performance**: Cache hit/miss impact analysis
- **Load Testing**: Concurrent and sustained load performance
- **Resource Usage**: Memory and CPU usage monitoring

#### `hybridRetrieval.golden.runner.ts`
Test runner with comprehensive reporting:
- **Automated Test Execution**: Runs all golden query tests
- **Performance Comparison**: Minimal vs full configuration benchmarking
- **Semantic Accuracy Testing**: Validates semantic understanding capabilities
- **Detailed Reporting**: Pass/fail rates, performance metrics, recommendations

## Golden Query Set

The test suite includes 12 carefully selected real questions that represent typical user interactions:

1. **Childhood Location**: "Where did you grow up?"
2. **Snake Story**: "What happened with the snake?" (semantic: snake → cobra)
3. **Brother Info**: "Tell me about your brother"
4. **Current Pet**: "Tell me about Romeo"
5. **Past Pets**: "Who were George and Olive?"
6. **Current Location**: "Where do you live now?"
7. **Partner Info**: "Tell me about Krissy"
8. **Music Interests**: "What music do you like?"
9. **Project Info**: "What is Echostone?"
10. **Political Opinions**: "What do you think about Trump?"
11. **Celebrity Encounters**: "Have you met any famous people?"
12. **Friend Info**: "Who is Tyler?"

## Core Semantic Connection Tests

Seven specific test cases validate semantic understanding:

1. **Snake → Cobra**: "snake story" should find Morocco cobra encounter
2. **SXSW → Concerts**: "meetings at SXSW" should find Bill Murray & GZA concert entries
3. **SXSW Concert Variation**: "SXSW concert" should find concert memories
4. **Tyler Identity**: "Who is Tyler?" should retrieve Tyler facts
5. **Tyler → Cansu**: "Tyler partner" should find Cansu information
6. **Olive Pet**: "Olive" should retrieve precise pet memories
7. **George Pet**: "George" should retrieve precise pet memories

## Performance Requirements

The test suite validates these performance targets:

- **Hybrid Disabled P95**: ≤300ms (current baseline)
- **Hybrid Enabled P95**: ≤600ms (with all features)
- **BM25 Component**: ≤50ms per query
- **Vector Search**: ≤100ms per query
- **Query Expansion**: ≤200ms when triggered
- **LLM Reranking**: ≤150ms when enabled

## Running the Tests

### Individual Test Files

```bash
# Run golden query tests
npm test hybridRetrieval.golden.test.ts

# Run fallback behavior tests
npm test hybridRetrieval.fallback.test.ts

# Run performance regression tests
npm test hybridRetrieval.performance.test.ts
```

### Complete Test Suite with Reporting

```bash
# Run the comprehensive test runner
npm test hybridRetrieval.golden.runner.ts
```

### All Hybrid Retrieval Tests

```bash
# Run all hybrid retrieval tests
npm test -- --testPathPattern="hybridRetrieval"
```

## Test Configuration

### Environment Variables

The tests respect these environment variables for configuration:

```bash
# Feature flags
RETRIEVAL_EMBEDDINGS=on|off
RETRIEVAL_EXPANSION=auto|off
RETRIEVAL_RERANK=on|off

# Performance tuning
RETRIEVAL_TIMEOUT_MS=500
RETRIEVAL_EXPANSION_THRESHOLD=0.3
RETRIEVAL_MAX_RESULTS=10

# Component configuration
RETRIEVAL_BM25_K1=1.2
RETRIEVAL_BM25_B=0.75
RETRIEVAL_VECTOR_THRESHOLD=0.3
```

### Test Data

Tests use a comprehensive factbook subset including:
- Identity information (name, location, pets)
- Family relationships (brother, parents)
- Personal relationships (partner, friends)
- Places and travel history
- Projects and interests
- Memories and experiences

## Test Reporting

The test runner provides detailed reporting including:

### Overall Results
- Total tests run
- Pass/fail counts and percentages
- Performance metrics (average, P95 latency)
- Confidence score analysis

### Method Usage Statistics
- BM25 usage percentage
- Vector search usage percentage
- Query expansion trigger rate
- Reranking application rate

### Performance Analysis
- Slowest performing tests
- Top performing tests by confidence
- Component timing breakdown
- Cache performance impact

### Recommendations
- Automated suggestions for improvement
- Performance optimization recommendations
- Accuracy enhancement suggestions

## Validation Criteria

### Test Success Criteria

A test passes when:
1. **Results Found**: At least one result returned
2. **Expected Content**: Contains expected snippet IDs or semantic matches
3. **Confidence Threshold**: Meets minimum confidence score
4. **Performance Target**: Completes within latency limits
5. **No Errors**: No unhandled errors or exceptions

### System Health Validation

Tests validate:
- Component health status
- Graceful degradation behavior
- Error handling and recovery
- Fallback mechanism effectiveness
- Performance consistency

## Integration with CI/CD

### Automated Testing

The test suite is designed for CI/CD integration:

```yaml
# Example GitHub Actions configuration
- name: Run Hybrid Retrieval Tests
  run: |
    npm test -- --testPathPattern="hybridRetrieval" --reporter=json --outputFile=test-results.json
    
- name: Validate Performance Requirements
  run: |
    npm test hybridRetrieval.performance.test.ts --reporter=json
```

### Performance Monitoring

Tests can be configured for continuous performance monitoring:

```bash
# Run performance tests with detailed metrics
npm test hybridRetrieval.performance.test.ts -- --verbose --reporter=verbose
```

## Troubleshooting

### Common Issues

1. **Factbook Loading Failures**
   - Ensure `data/jonathan_profile_factbook.json` exists
   - Check file permissions and format

2. **Performance Test Failures**
   - Verify system resources (CPU, memory)
   - Check for background processes affecting performance
   - Ensure OpenAI API keys are configured for LLM features

3. **Semantic Connection Failures**
   - Verify embedding service is available
   - Check vector index building process
   - Validate query expansion configuration

### Debug Mode

Enable detailed logging for debugging:

```bash
# Run tests with debug logging
DEBUG=hybrid-retrieval npm test hybridRetrieval.golden.test.ts
```

### Test Data Validation

Verify test data integrity:

```bash
# Validate factbook data structure
npm run validate-factbook
```

## Contributing

### Adding New Golden Queries

To add new golden queries:

1. Add to `GOLDEN_QUERIES` array in `hybridRetrieval.golden.test.ts`
2. Include expected snippets and minimum confidence
3. Add description explaining the test purpose
4. Update documentation

### Performance Benchmarks

To add new performance benchmarks:

1. Add to `PERFORMANCE_TARGETS` in `hybridRetrieval.performance.test.ts`
2. Create corresponding test cases
3. Update CI/CD validation thresholds
4. Document new requirements

### Semantic Tests

To add new semantic connection tests:

1. Add to `SEMANTIC_CONNECTION_TESTS` array
2. Define expected semantic relationships
3. Validate with actual factbook content
4. Test across different query phrasings

## Maintenance

### Regular Updates

- Review and update golden queries quarterly
- Validate performance targets against system changes
- Update expected snippets when factbook changes
- Refresh semantic connection tests with new content

### Performance Baselines

- Establish new baselines after major system changes
- Monitor performance trends over time
- Adjust targets based on infrastructure improvements
- Document performance regression investigations

This comprehensive test suite ensures the hybrid retrieval system meets all requirements while providing detailed validation and monitoring capabilities.