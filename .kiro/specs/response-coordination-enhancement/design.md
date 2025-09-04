# Design Document

## Overview

The response coordination enhancement will implement a sophisticated system to coordinate content between fast and deep lanes, ensuring they complement rather than repeat each other. The design focuses on creating distinct roles for each lane: the fast lane as an engaging "hook" and the deep lane as rich storytelling that builds upon the fast lane's foundation.

## Architecture

### Core Components

1. **Memory Content Analyzer**: Analyzes retrieved memories to identify different aspects (opinion, story, context, details)
2. **Fast Lane Content Selector**: Selects the most engaging hook from available memories
3. **Deep Lane Content Coordinator**: Receives fast lane selection and chooses complementary content
4. **Response Flow Manager**: Orchestrates the handoff between lanes and ensures natural transitions

### Data Flow

```
Memory Retrieval → Content Analysis → Fast Lane Selection → Deep Lane Coordination → Response Generation
```

## Components and Interfaces

### Memory Content Analyzer

**Purpose**: Analyze retrieved memories to categorize content types and identify coordination opportunities.

**Interface**:
```typescript
interface MemoryAnalysis {
  memoryId: string;
  contentTypes: ('opinion' | 'story' | 'fact' | 'emotion' | 'context')[];
  hookPotential: number; // 0-1 score for fast lane appeal
  storyDepth: number; // 0-1 score for deep lane potential
  emotionalTone: 'positive' | 'negative' | 'neutral' | 'mixed';
  keyElements: string[]; // Key phrases or concepts
}

function analyzeMemoryContent(memories: Memory[]): MemoryAnalysis[]
```

### Fast Lane Content Selector

**Purpose**: Select the most engaging content for immediate response while marking what should be expanded in deep lane.

**Interface**:
```typescript
interface FastLaneSelection {
  selectedContent: string;
  contentType: 'hook' | 'teaser' | 'opinion' | 'enthusiasm';
  deepLaneHints: {
    expandOn: string[]; // What aspects to expand
    avoidRepeating: string[]; // What not to repeat
    suggestedTone: string; // Tone to maintain
    relatedMemories: string[]; // Other memories to weave in
  };
}

function selectFastLaneContent(
  analysis: MemoryAnalysis[], 
  query: string, 
  intent: string
): FastLaneSelection
```

### Deep Lane Content Coordinator

**Purpose**: Generate rich, detailed content that builds on fast lane selection without repetition.

**Interface**:
```typescript
interface DeepLaneStrategy {
  approach: 'elaborate' | 'continue_story' | 'add_context' | 'provide_examples';
  contentSources: string[]; // Which memories to use
  avoidanceRules: string[]; // What to avoid repeating
  transitionStyle: 'seamless' | 'building' | 'contrasting';
}

function coordinateDeepLaneContent(
  fastLaneSelection: FastLaneSelection,
  availableMemories: Memory[],
  analysis: MemoryAnalysis[]
): DeepLaneStrategy
```

## Data Models

### Enhanced Memory Context

```typescript
interface EnhancedMemory extends Memory {
  analysisData?: MemoryAnalysis;
  coordinationMetadata?: {
    usedInFastLane: boolean;
    fastLaneAspects: string[];
    availableForDeep: string[];
    relationshipToOthers: string[];
  };
}
```

### Coordination State

```typescript
interface CoordinationState {
  fastLaneContent: FastLaneSelection | null;
  deepLaneStrategy: DeepLaneStrategy | null;
  usedMemoryIds: Set<string>;
  conversationTone: string;
  topicContext: string;
}
```

## Error Handling

### Memory Analysis Failures
- **Fallback**: Use simple content type detection based on memory metadata
- **Logging**: Log analysis failures for debugging
- **Graceful Degradation**: Continue with basic coordination if analysis fails

### Content Selection Conflicts
- **Priority System**: Opinion > Story > Fact for fast lane selection
- **Backup Selection**: Always have 2-3 backup content options
- **Default Behavior**: Fall back to current behavior if coordination fails

### Deep Lane Coordination Issues
- **Safety Net**: If coordination fails, use traditional memory-based response
- **Repetition Detection**: Runtime detection of content overlap with warnings
- **Recovery**: Ability to adjust strategy mid-response if repetition detected

## Testing Strategy

### Unit Tests
- Memory content analysis accuracy
- Fast lane content selection logic
- Deep lane coordination strategy generation
- Repetition detection algorithms

### Integration Tests
- End-to-end coordination flow
- Fast-to-deep lane handoff scenarios
- Multiple memory coordination
- Edge cases (no memories, single memory, conflicting memories)

### User Experience Tests
- A/B testing of coordinated vs. uncoordinated responses
- Response quality metrics (engagement, naturalness, information density)
- Repetition detection in real conversations
- User satisfaction with conversation flow

### Performance Tests
- Memory analysis performance impact
- Coordination overhead measurement
- Response latency with coordination enabled
- Memory usage optimization

## Implementation Phases

### Phase 1: Core Coordination Infrastructure
- Implement Memory Content Analyzer
- Create basic Fast Lane Content Selector
- Add coordination state management
- Basic repetition avoidance

### Phase 2: Advanced Coordination Strategies
- Implement Deep Lane Content Coordinator
- Add sophisticated content analysis
- Implement transition style management
- Advanced repetition detection

### Phase 3: Optimization and Polish
- Performance optimization
- Advanced testing and metrics
- Fine-tuning coordination rules
- User experience improvements

## Configuration and Customization

### Coordination Rules Configuration
```typescript
interface CoordinationConfig {
  fastLaneMaxLength: number;
  repetitionThreshold: number; // Similarity threshold for repetition detection
  preferredTransitionStyles: string[];
  contentTypeWeights: Record<string, number>;
  debugLogging: boolean;
}
```

### Per-Intent Coordination Strategies
- **Opinion queries**: Fast lane = strong stance, Deep lane = supporting stories
- **Experience queries**: Fast lane = exciting teaser, Deep lane = full narrative
- **People queries**: Fast lane = warm introduction, Deep lane = relationship stories
- **General queries**: Fast lane = personality-driven response, Deep lane = relevant memories