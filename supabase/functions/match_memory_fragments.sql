-- Function to perform vector similarity search for memory fragments
CREATE OR REPLACE FUNCTION match_memory_fragments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  target_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  fragment_text text,
  conversation_context jsonb,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    memory_fragments.id,
    memory_fragments.user_id,
    memory_fragments.fragment_text,
    memory_fragments.conversation_context,
    1 - (memory_fragments.embedding <=> query_embedding) AS similarity,
    memory_fragments.created_at
  FROM memory_fragments
  WHERE 
    (target_user_id IS NULL OR memory_fragments.user_id = target_user_id)
    AND 1 - (memory_fragments.embedding <=> query_embedding) > match_threshold
  ORDER BY memory_fragments.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;