/**
 * Streaming Coordinator - Hybrid Stream Orchestration
 * Manages Fast Lane + Deep Lane token streaming with seamless merging
 */

/**
 * Hybrid streaming coordinator
 * Yields Fast Lane tokens immediately, then seamlessly continues with Deep Lane
 */
export async function* hybridStream(options: {
  fastLaneSeed: string;
  deepLaneIterator: AsyncIterable<string>;
  openaiClient: any;
  userText: string;
  maxFastTokens?: number;
}): AsyncIterable<string> {
  const { fastLaneSeed, deepLaneIterator, openaiClient, userText, maxFastTokens = 150 } = options;
  
  let fastTokenCount = 0;
  let fastComplete = false;
  let fullFastResponse = '';

  try {
    // Start Fast Lane streaming immediately
    const fastMessages = [
      { role: 'system' as const, content: fastLaneSeed },
      { role: 'user' as const, content: userText }
    ];

    const fastResponse = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: fastMessages,
      temperature: 0.3,
      max_tokens: maxFastTokens,
      top_p: 1,
      frequency_penalty: 0.2,
      presence_penalty: 0
    });

    // Stream Fast Lane tokens first
    for await (const chunk of fastResponse) {
      const token = chunk.choices?.[0]?.delta?.content || '';
      if (token) {
        fullFastResponse += token;
        fastTokenCount++;
        yield token;
      }
      
      // Check if Fast Lane is complete
      if (chunk.choices?.[0]?.finish_reason) {
        fastComplete = true;
        break;
      }
    }

    // Add smooth transition if Fast Lane completed naturally
    if (fastComplete && !fullFastResponse.trim().endsWith('.')) {
      const transition = '. ';
      yield transition;
      fullFastResponse += transition;
    }

    // Continue with Deep Lane tokens
    let deepTokenCount = 0;
    for await (const token of deepLaneIterator) {
      if (token) {
        deepTokenCount++;
        yield token;
      }
    }

    // Log performance metrics
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Hybrid Stream: Fast=${fastTokenCount} tokens, Deep=${deepTokenCount} tokens`);
    }

  } catch (error) {
    console.warn('Hybrid streaming error:', error);
    
    // Graceful fallback - if Fast Lane failed, provide a basic response
    if (fastTokenCount === 0) {
      yield 'I\'d be happy to help with that. ';
    }
    
    // If Deep Lane fails, Fast Lane should have provided a complete response
    if (!fastComplete) {
      yield ' What would you like to know more about?';
    }
  }
}

/**
 * Simple streaming wrapper for non-hybrid scenarios
 */
export async function* simpleStream(
  openaiClient: any,
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
): AsyncIterable<string> {
  const {
    model = 'gpt-4o-mini',
    temperature = 0.3,
    max_tokens = 400
  } = options;

  try {
    const response = await openaiClient.chat.completions.create({
      model,
      stream: true,
      messages,
      temperature,
      max_tokens,
      top_p: 1,
      frequency_penalty: 0.2,
      presence_penalty: 0
    });

    for await (const chunk of response) {
      const token = chunk.choices?.[0]?.delta?.content || '';
      if (token) {
        yield token;
      }
    }
  } catch (error) {
    console.warn('Simple streaming error:', error);
    yield 'I apologize, but I\'m having trouble responding right now. Please try again.';
  }
}

/**
 * Create a ReadableStream from an async iterator
 */
export function createStreamResponse(
  iterator: AsyncIterable<string>,
  headers: Record<string, string> = {}
): Response {
  const encoder = new TextEncoder();
  
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const token of iterator) {
          controller.enqueue(encoder.encode(token));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  const responseHeaders = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    ...headers
  });

  return new Response(readable, { headers: responseHeaders });
}

/**
 * Measure streaming performance
 */
export class StreamingMetrics {
  private startTime: number;
  private firstTokenTime?: number;
  private tokenCount = 0;
  private fastTokenCount = 0;
  private deepTokenCount = 0;

  constructor() {
    this.startTime = Date.now();
  }

  recordFirstToken() {
    if (!this.firstTokenTime) {
      this.firstTokenTime = Date.now();
    }
  }

  recordToken(source: 'fast' | 'deep' = 'fast') {
    this.tokenCount++;
    if (source === 'fast') {
      this.fastTokenCount++;
    } else {
      this.deepTokenCount++;
    }
  }

  getMetrics() {
    const now = Date.now();
    return {
      totalLatency: now - this.startTime,
      firstTokenLatency: this.firstTokenTime ? this.firstTokenTime - this.startTime : undefined,
      tokenCount: this.tokenCount,
      fastTokenCount: this.fastTokenCount,
      deepTokenCount: this.deepTokenCount,
      tokensPerSecond: this.tokenCount / ((now - this.startTime) / 1000)
    };
  }
}

/**
 * Enhanced hybrid stream with metrics
 */
export async function* hybridStreamWithMetrics(options: {
  fastLaneSeed: string;
  deepLaneIterator: AsyncIterable<string>;
  openaiClient: any;
  userText: string;
  maxFastTokens?: number;
  onMetrics?: (metrics: any) => void;
}): AsyncIterable<string> {
  const metrics = new StreamingMetrics();
  let firstTokenRecorded = false;

  try {
    for await (const token of hybridStream(options)) {
      if (!firstTokenRecorded) {
        metrics.recordFirstToken();
        firstTokenRecorded = true;
      }
      
      metrics.recordToken();
      yield token;
    }

    // Report final metrics
    if (options.onMetrics) {
      options.onMetrics(metrics.getMetrics());
    }

  } catch (error) {
    console.warn('Hybrid streaming with metrics error:', error);
    throw error;
  }
}