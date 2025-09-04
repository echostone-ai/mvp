# Coordination Acceptance Tests

This document describes the comprehensive acceptance tests for the response coordination enhancement system.

## Overview

The coordination acceptance tests validate that the fast and deep lanes work together effectively to provide complementary, non-repetitive responses that create a natural conversation flow.

## Test Coverage

### 1. Fast Lane Hook Selection for Different Intents

Tests that the fast lane selects appropriate hooks based on query intent:

- **Opinion queries**: Should provide strong stance/opinion as hook
- **Travel queries**: Should provide enthusiastic teaser about interesting aspects  
- **People queries**: Should provide warm, personal introduction
- **Content length**: Should cap hook content to ~180 characters
- **Fallback behavior**: Should provide appropriate fallbacks when no memories found

### 2. Deep Lane Coordination Without Repetition

Tests that the deep lane builds on fast lane content without repetition:

- **Opinion expansion**: Should elaborate with supporting experiences and stories
- **Travel expansion**: Should provide full stories with vivid details
- **People expansion**: Should provide relationship stories and deeper context
- **Coordination hints**: Should use expandOn, avoidRepeating, and tone guidance

### 3. Repetition Detection and Prevention

Tests the repetition guard system:

- **High overlap detection**: Should detect when content overlaps significantly
- **Complementary content**: Should allow complementary content without false positives
- **Edge cases**: Should handle empty content, short content, and identical content
- **Performance**: Should complete analysis quickly

### 4. Natural Conversation Flow

Tests that coordination creates natural conversation flow:

- **Tone consistency**: Should maintain emotional tone between lanes
- **Transition hints**: Should provide clear guidance for deep lane
- **Topic adaptation**: Should adapt coordination strategy by topic type

### 5. Performance Requirements

Tests that coordination meets performance requirements:

- **Memory analysis**: Should complete under 10ms for typical memory sets
- **Hook selection**: Should complete very quickly (<10ms)
- **Repetition analysis**: Should complete quickly (<10ms)
- **Overall performance**: Fast lane <200ms, total response <1.2s

### 6. Content Distribution Rules

Tests clear rules for content distribution:

- **Content splitting**: Should have clear rules for splitting content between lanes
- **Usage marking**: Should mark what aspects deep lane should focus on
- **Presentation strategies**: Should use different strategies for same memory

### 7. Integration Scenarios

Tests end-to-end coordination for different query types:

- **Opinion queries**: Full coordination flow with critical tone
- **Travel queries**: Full coordination flow with enthusiastic tone
- **People queries**: Full coordination flow with warm tone

## Running the Tests

### Unit Tests

Run the comprehensive unit test suite:

```bash
npm test -- --run src/lib/services/__tests__/coordinationAcceptance.test.ts
```

This validates all coordination components in isolation with mock data.

### Integration Tests

Run the end-to-end integration tests (requires running server):

```bash
# Start the development server
npm run dev

# In another terminal, run integration tests
node test-coordination-acceptance.js
```

This validates the full coordination system with real API calls.

## Test Results Interpretation

### Unit Test Results

- **23 tests total** covering all coordination aspects
- Tests validate requirements 1.1, 1.2, 1.3, and 4.1 from the spec
- Performance tests ensure sub-10ms execution for coordination components

### Integration Test Results

The integration tests validate:

- **Performance**: Fast lane <200ms, total <1.2s
- **Content quality**: Appropriate hooks for different intents
- **Coordination logging**: System logs coordination decisions
- **Repetition control**: Overlap stays within acceptable limits

### Success Criteria

All tests should pass with:

- ✅ Fast lane hook selection working for all intents
- ✅ Deep lane coordination without excessive repetition
- ✅ Performance within specified thresholds
- ✅ Natural conversation flow maintained
- ✅ Content distribution rules followed

## Troubleshooting

### Common Issues

1. **Server not running**: Integration tests require `npm run dev`
2. **Performance failures**: May indicate system load or coordination overhead
3. **Repetition failures**: May indicate coordination hints not working properly
4. **Content failures**: May indicate memory analysis or hook selection issues

### Debug Information

The tests provide detailed logging:

- Memory analysis results and timing
- Hook selection decisions and content
- Coordination hints and deep lane guidance
- Repetition analysis with overlap percentages
- Performance metrics for each component

## Requirements Validation

These tests validate the following requirements from the spec:

- **Requirement 1.1**: Fast and deep lanes complement each other
- **Requirement 1.2**: Fast lane provides immediate, engaging responses  
- **Requirement 1.3**: Deep lane builds on fast lane without repetition
- **Requirement 4.1**: Natural conversation flow between lanes

The tests ensure the coordination system meets all acceptance criteria and performance requirements specified in the design document.