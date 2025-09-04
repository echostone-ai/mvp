-- DB Performance Indexes

-- quick_facts
create index if not exists idx_quick_facts_avatar_key on quick_facts(avatar_id, key);
create index if not exists idx_quick_facts_priority on quick_facts(avatar_id, priority);

-- memory_fragments
create index if not exists idx_memfrags_avatar_created on memory_fragments(avatar_id, created_at desc);
create index if not exists idx_memfrags_avatar_conv on memory_fragments(avatar_id, (conversation_context ->> 'conversation_id'));
-- if using embeddings via pgvector:
-- create index if not exists memfrags_embedding_idx on memory_fragments using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- conversation history (if stored separately)
create index if not exists idx_convo_turns_session on conversation_turns(session_id, created_at);



