/**
 * Shared types for GPT-5 Avatar Memory Upgrade services
 */

export interface QuickFact {
  id: string;
  avatarId: string;
  key: string;
  value: string;
  confidence?: number;
  priority?: number;
  source?: 'heuristic' | 'llm' | 'manual' | 'extraction';
  sourceReference?: string;
  dateContext?: {
    year?: number;
    month?: number;
    day?: number;
  };
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
}

export interface MemoryFragment {
  id: string;
  userId?: string;
  avatarId: string;
  fragmentText: string;
  embedding?: number[];
  conversationContext: {
    source: string;
    type: 'user' | 'assistant';
    conversationId: string;
    visitorId?: string;
    gist?: string;
    tags?: string[];
    title?: string;
    people?: string[];
    startDate?: string;
    endDate?: string;
    year?: number;
  };
  similarity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    extractedEntities?: string[];
    emotionalTone?: string;
  };
}

export interface StructuredContext {
  quickFacts: QuickFact[];
  memoryFragments: MemoryFragment[];
  conversationHistory: ConversationTurn[];
  retrievalMetadata: RetrievalMetadata;
}

export interface RetrievalMetadata {
  source: string;
  timestamp: string;
  totalFacts: number;
  totalMemories: number;
  totalHistory: number;
  cacheHit?: boolean;
  queryTime?: number;
  optimizations?: string[];
}

export interface RetrievalOptions {
  priorityFilter?: number;
  memoryLimit?: number;
  historyLimit?: number;
  fastMode?: boolean;
  confidenceThreshold?: number;
}

export interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
  priority: number;
  source: string;
  sourceReference: string;
}

export interface ConversationSession {
  sessionId: string;
  avatarId: string;
  visitorId: string;
  turns: ConversationTurn[];
  startTime: string;
  lastActivity: string;
  context: Record<string, any>;
}

export interface GPT5Response {
  text: string;
  confidence: number;
  extractedFacts: ExtractedFact[];
  modelUsed: string;
  processingTime: number;
}