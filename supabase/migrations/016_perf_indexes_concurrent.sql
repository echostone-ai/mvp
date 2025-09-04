-- Concurrent/online index creation to avoid write locks
-- Note: If your migration runner wraps in a transaction, split these into a non-transactional migration per Supabase guidance.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quick_facts_avatar_key
  ON public.quick_facts (avatar_id, key);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_avatar_created
  ON public.memory_fragments (avatar_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_turns_session_time
  ON public.conversation_turns (session_id, created_at DESC);



