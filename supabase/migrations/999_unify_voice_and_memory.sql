-- supabase/migrations/999_unify_voice_and_memory.sql

-- 1) RPC: upsert_optimized_profile (SECURITY DEFINER) for server-only writes
create or replace function public.upsert_optimized_profile(
  in_id text,
  in_name text,
  in_core_personality text,
  in_quick_facts text,
  in_conversation_style text,
  in_current_context text
) returns void
language plpgsql
security definer
as $$
begin
  insert into optimized_profiles (id, name, core_personality, quick_facts, conversation_style, current_context, cached_at)
  values (in_id, in_name, in_core_personality, in_quick_facts, in_conversation_style, in_current_context, now())
  on conflict (id) do update set
    name = excluded.name,
    core_personality = excluded.core_personality,
    quick_facts = excluded.quick_facts,
    conversation_style = excluded.conversation_style,
    current_context = excluded.current_context,
    cached_at = now();
end;
$$;

revoke all on function public.upsert_optimized_profile(text, text, text, text, text, text) from public;
grant execute on function public.upsert_optimized_profile(text, text, text, text, text, text) to service_role;

-- 2) RPC: search_memory_fragments (pgvector cosine) with RLS-safe filtering params
-- Requires: extension vector; memory_fragments(embedding vector(1536)) exists
create or replace function public.search_memory_fragments(
  in_user_id uuid,
  in_avatar_id uuid,
  in_query_embedding vector,
  in_limit int default 6
) returns table(id uuid, fragment_text text, created_at timestamptz)
language sql
stable
as $$
  select mf.id, mf.fragment_text, mf.created_at
  from memory_fragments mf
  where mf.user_id = in_user_id
    and (in_avatar_id is null or mf.avatar_id = in_avatar_id)
  order by mf.embedding <-> in_query_embedding
  limit in_limit
$$;

revoke all on function public.search_memory_fragments(uuid, uuid, vector, int) from public;
grant execute on function public.search_memory_fragments(uuid, uuid, vector, int) to authenticated;

-- 3) Helpful index if missing
create index if not exists memory_fragments_created_at_idx on memory_fragments(created_at);
