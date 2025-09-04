-- Optional indexes to speed up memory reads
create index if not exists idx_memory_avatar_created_at
  on memory_fragments(avatar_id, created_at desc);

-- If JSONB GIN is available
create index if not exists idx_memory_context_gin
  on memory_fragments using gin (conversation_context);




