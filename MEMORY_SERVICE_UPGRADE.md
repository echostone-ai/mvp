# Memory Service Upgrade for Avatar Support

To fully implement avatar-specific memories, you'll need to update the `memoryService.ts` file with the changes from `memoryServiceAvatarUpdates.ts`. Here's how to do it:

## 1. Update the Database Schema

First, run the SQL migration in your Supabase project:

```sql
-- Run this in your Supabase SQL Editor
-- From the file: setup-avatar-support.sql
```

## 2. Update the Memory Service

The key changes needed in `src/lib/memoryService.ts`:

### Update the MemoryFragment interface

```typescript
export interface MemoryFragment {
  id?: string;
  userId: string;
  avatarId?: string; // Add this field
  fragmentText: string;
  embedding?: number[];
  conversationContext?: {
    timestamp: string;
    messageContext?: string;
    emotionalTone?: string;
    avatarId?: string; // Add this field too
  };
  createdAt?: Date;
  updatedAt?: Date;
  similarity?: number;
}
```

### Update the getEnhancedMemoryContext method

```typescript
static async getEnhancedMemoryContext(
  query: string,
  userId: string,
  profileData: any,
  limit: number = 5,
  avatarId?: string, // Add this parameter
  similarityThreshold: number = 0.65
): Promise<{
  memories: MemoryFragment[];
  contextPrompt: string;
  personalityEnhancements: string[];
}> {
  // ...existing code...
  
  // Get relevant memories with avatar context
  const memories = await MemoryRetrievalService.retrieveRelevantMemories(
    query,
    userId,
    { 
      limit, 
      similarityThreshold, 
      includeContext: true,
      avatarId // Pass avatarId
    }
  );
  
  // ...rest of the function...
}
```

### Update the retrieveRelevantMemories method

```typescript
static async retrieveRelevantMemories(
  query: string,
  userId: string,
  options: {
    limit?: number;
    similarityThreshold?: number;
    includeContext?: boolean;
    avatarId?: string; // Add this parameter
  } = {}
): Promise<MemoryFragment[]> {
  // ...existing code...
  
  // Add avatarId to the query if provided
  const queryParams: any = {
    query_embedding: queryEmbedding,
    match_threshold: similarityThreshold,
    match_count: limit,
    target_user_id: userId
  };
  
  if (options.avatarId) {
    queryParams.target_avatar_id = options.avatarId;
  }
  
  // ...rest of the function...
}
```

### Update the storeMemoryFragment method

```typescript
static async storeMemoryFragment(fragment: MemoryFragment): Promise<string> {
  // ...existing code...
  
  // Extract avatarId from conversationContext if present
  const avatarId = fragment.avatarId || fragment.conversationContext?.avatarId;
  
  const { data, error } = await supabase
    .from('memory_fragments')
    .insert({
      user_id: fragment.userId,
      avatar_id: avatarId, // Add this field
      fragment_text: fragment.fragmentText,
      embedding: fragment.embedding,
      conversation_context: fragment.conversationContext || {}
    })
    .select('id')
    .single();
  
  // ...rest of the function...
}
```

### Update the processAndStoreMemories method

```typescript
static async processAndStoreMemories(
  message: string,
  userId: string,
  conversationContext?: any,
  extractionThreshold?: number
): Promise<MemoryFragment[]> {
  // ...existing code...
  
  // Add avatarId to each fragment if present in conversationContext
  if (conversationContext?.avatarId) {
    fragments.forEach(fragment => {
      fragment.avatarId = conversationContext.avatarId;
    });
  }
  
  // ...rest of the function...
}
```

## 3. Update the match_memory_fragments Function in Supabase

Make sure the SQL function is updated to support filtering by avatar ID:

```sql
CREATE OR REPLACE FUNCTION match_memory_fragments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  target_user_id uuid DEFAULT NULL,
  target_avatar_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  avatar_id uuid,
  fragment_text text,
  conversation_context jsonb,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  embedding vector(1536)
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    memory_fragments.id,
    memory_fragments.user_id,
    memory_fragments.avatar_id,
    memory_fragments.fragment_text,
    memory_fragments.conversation_context,
    1 - (memory_fragments.embedding <=> query_embedding) AS similarity,
    memory_fragments.created_at,
    memory_fragments.updated_at,
    memory_fragments.embedding
  FROM memory_fragments
  WHERE 
    (target_user_id IS NULL OR memory_fragments.user_id = target_user_id)
    AND (target_avatar_id IS NULL OR memory_fragments.avatar_id = target_avatar_id)
    AND 1 - (memory_fragments.embedding <=> query_embedding) > match_threshold
  ORDER BY memory_fragments.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;
```

## Regarding Supabase Upgrade

You don't need to upgrade your Supabase instance to implement these changes. The avatar memory system can work with your current Supabase setup as long as you:

1. Run the SQL migration to add the avatar_id column and update the functions
2. Update your memory service code to handle the avatar_id parameter

The current implementation will still work without avatar-specific memories, but once you make these updates, you'll have full avatar memory isolation.