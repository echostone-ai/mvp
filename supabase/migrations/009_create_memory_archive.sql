-- Migration: Create memory_archive table to preserve previous versions of memory_fragments

CREATE TABLE IF NOT EXISTS public.memory_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fragment_id UUID NOT NULL,
  avatar_id UUID,
  user_id UUID,
  previous_text TEXT NOT NULL,
  new_text TEXT,
  original_created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  change_source TEXT DEFAULT 'manual' CHECK (change_source IN ('manual','system','conversation')),
  notes TEXT
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS memory_archive_fragment_idx ON public.memory_archive(fragment_id);
CREATE INDEX IF NOT EXISTS memory_archive_avatar_idx ON public.memory_archive(avatar_id);
CREATE INDEX IF NOT EXISTS memory_archive_user_idx ON public.memory_archive(user_id);
CREATE INDEX IF NOT EXISTS memory_archive_archived_at_idx ON public.memory_archive(archived_at);

COMMENT ON TABLE public.memory_archive IS 'Preserves previous versions of memory_fragments when edited.';
COMMENT ON COLUMN public.memory_archive.previous_text IS 'The text value before the update.';
COMMENT ON COLUMN public.memory_archive.new_text IS 'The text value after the update (if captured by the updater).';

