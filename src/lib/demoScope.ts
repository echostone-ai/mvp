/**
 * Demo Scope Management
 * Centralized demo mode memory scoping logic
 */

export interface DemoScopeOptions {
  avatarId: string;
  visitorId?: string;
  conversationId?: string;
  isDemo?: boolean;
}

/**
 * Generate SQL where clause fragment for demo memory scoping
 */
export function scopeMemories(options: DemoScopeOptions): string {
  const { avatarId, visitorId, conversationId, isDemo } = options;

  if (!isDemo) {
    // Normal mode: exclude demo memories
    return `
      avatar_id = '${avatarId}' 
      AND (
        conversation_context->>'conversation_id' IS NULL 
        OR conversation_context->>'conversation_id' != 'jonathan-demo'
      )
    `;
  }

  // Demo mode: include global seed memories + visitor-scoped memories
  const conditions = [
    `avatar_id = '${avatarId}'`,
    `(
      -- Global seed memories (identity, bio, language_style, story)
      (
        conversation_context->>'ctx_type' IN ('identity', 'bio', 'language_style', 'story')
        AND conversation_context->>'visitor_id' IS NULL
        AND conversation_context->>'conversation_id' IS NULL
      )
      OR
      -- Bio memories with simple context structure
      (
        conversation_context->>'type' = 'bio'
        AND conversation_context->>'visitor_id' IS NULL
        AND conversation_context->>'conversation_id' IS NULL
      )
      OR
      -- Avatar's own memories
      (
        conversation_context->>'source' = 'avatar_personal_memory'
        OR conversation_context->'tags' ? 'avatar_memory'
        OR conversation_context->'tags' ? 'personal_story'
        OR conversation_context->>'is_avatar_memory' = 'true'
      )
      ${visitorId ? `OR
      -- Visitor-scoped demo memories that haven't expired
      (
        conversation_context->>'conversation_id' = 'jonathan-demo'
        AND conversation_context->>'visitor_id' = '${visitorId}'
        AND (
          conversation_context->>'expires_at' IS NULL
          OR conversation_context->>'expires_at' > NOW()::text
        )
      )` : ''}
      OR
      -- Permanent demo memories
      (
        conversation_context->>'conversation_id' = 'jonathan-demo'
        AND conversation_context->>'expires_at' IS NULL
      )
    )`
  ];

  return conditions.join(' AND ');
}

/**
 * Filter memories in JavaScript for complex demo scoping
 */
export function filterDemoMemories(
  memories: any[], 
  options: DemoScopeOptions
): any[] {
  const { visitorId, isDemo } = options;

  if (!isDemo) {
    // Normal mode: exclude demo memories
    return memories.filter(memory => {
      const ctx = memory.conversation_context || {};
      return ctx.conversation_id !== 'jonathan-demo';
    });
  }

  // Demo mode: apply complex filtering logic
  return memories.filter(memory => {
    const ctx = memory.conversation_context || {};
    const text = memory.fragment_text?.toLowerCase() || '';
    
    // Include global seed memories
    if (['identity', 'bio', 'language_style', 'story'].includes(ctx.ctx_type) && 
        !ctx.visitor_id && !ctx.conversation_id) {
      return true;
    }
    
    // Include bio memories with simple context structure
    if (ctx.type === 'bio' && !ctx.visitor_id && !ctx.conversation_id) {
      return true;
    }
    
    // Always include bio/travel/people contexts - never filter these out
    if (['bio', 'travel', 'people', 'relationship', 'timeline'].includes(ctx.type)) {
      return true;
    }
    
    // Always include Austin years, friend contexts, pet contexts
    if (text.includes('austin') || text.includes('2009') || text.includes('2018') ||
        ['austin_years', 'friend_tyler', 'friend_kate', 'pet_olive', 'pet_romeo'].some(c => 
          ctx.context?.includes(c) || text.includes(c.replace('_', ' ')))) {
      return true;
    }
    
    // Include avatar's own memories
    if (ctx.source === 'avatar_personal_memory' || 
        ctx.tags?.includes('avatar_memory') ||
        ctx.tags?.includes('personal_story') ||
        ctx.is_avatar_memory === true) {
      return true;
    }
    
    // Include visitor-scoped demo memories that haven't expired
    if (ctx.conversation_id === 'jonathan-demo' && 
        ctx.visitor_id === visitorId &&
        ctx.expires_at && new Date(ctx.expires_at) > new Date()) {
      return true;
    }
    
    // Include permanent demo memories
    if (ctx.conversation_id === 'jonathan-demo' && !ctx.expires_at) {
      return true;
    }
    
    return false;
  });
}

/**
 * Get demo scope summary for debugging
 */
export function getDemoScopeSummary(
  memories: any[], 
  options: DemoScopeOptions
): {
  total: number;
  globalSeed: number;
  bioMemories: number;
  avatarPersonal: number;
  visitorScoped: number;
  permanent: number;
} {
  const { visitorId, isDemo } = options;
  
  if (!isDemo) {
    return {
      total: memories.length,
      globalSeed: 0,
      bioMemories: 0,
      avatarPersonal: 0,
      visitorScoped: 0,
      permanent: 0
    };
  }

  let globalSeed = 0;
  let bioMemories = 0;
  let avatarPersonal = 0;
  let visitorScoped = 0;
  let permanent = 0;

  memories.forEach(memory => {
    const ctx = memory.conversation_context || {};
    
    if (['identity', 'bio', 'language_style', 'story'].includes(ctx.ctx_type) && 
        !ctx.visitor_id && !ctx.conversation_id) {
      globalSeed++;
    } else if (ctx.type === 'bio' && !ctx.visitor_id && !ctx.conversation_id) {
      bioMemories++;
    } else if (ctx.source === 'avatar_personal_memory' || 
               ctx.tags?.includes('avatar_memory') ||
               ctx.tags?.includes('personal_story') ||
               ctx.is_avatar_memory === true) {
      avatarPersonal++;
    } else if (ctx.conversation_id === 'jonathan-demo' && 
               ctx.visitor_id === visitorId &&
               ctx.expires_at && new Date(ctx.expires_at) > new Date()) {
      visitorScoped++;
    } else if (ctx.conversation_id === 'jonathan-demo' && !ctx.expires_at) {
      permanent++;
    }
  });

  return {
    total: memories.length,
    globalSeed,
    bioMemories,
    avatarPersonal,
    visitorScoped,
    permanent
  };
}