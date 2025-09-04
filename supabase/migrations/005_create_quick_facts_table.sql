-- Migration: Create quick_facts table for hot facts extraction pipeline
-- This table stores key identity facts for avatars that are always injected into prompts

-- Create the quick_facts table
CREATE TABLE public.quick_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id UUID NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1=highest (core identity), 10=lowest (trivia)
    source TEXT DEFAULT 'extraction' CHECK (source IN ('heuristic', 'llm', 'manual', 'extraction')),
    source_reference TEXT, -- "From user's journal, 2025-05-10"
    date_context JSONB, -- {"year": 1994, "month": 7, "day": null} for time-stamped events
    expires_at TIMESTAMPTZ, -- For facts that become outdated
    media_reference TEXT, -- Future: link to photos/videos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (avatar_id, key)
);

-- Create indexes for performance optimization
CREATE INDEX quick_facts_avatar_idx ON public.quick_facts(avatar_id);
CREATE INDEX quick_facts_priority_idx ON public.quick_facts(avatar_id, priority);
CREATE INDEX quick_facts_key_idx ON public.quick_facts(avatar_id, key);
CREATE INDEX quick_facts_expires_at_idx ON public.quick_facts(expires_at) WHERE expires_at IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.quick_facts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for public read access (as specified in requirements)
-- This allows the system to read facts for prompt building without user authentication
CREATE POLICY "Public read access for quick_facts" ON public.quick_facts
    FOR SELECT USING (true);

-- Create RLS policy for service-level writes only
-- Only the service role can insert/update/delete facts
CREATE POLICY "Service role can manage quick_facts" ON public.quick_facts
    FOR ALL USING (auth.role() = 'service_role');

-- Create trigger function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_quick_facts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_quick_facts_updated_at 
    BEFORE UPDATE ON public.quick_facts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_quick_facts_updated_at();

-- Add helpful comments for documentation
COMMENT ON TABLE public.quick_facts IS 'Stores key identity facts for avatars that are always injected into prompts to prevent hallucination';
COMMENT ON COLUMN public.quick_facts.priority IS 'Priority level: 1=highest (core identity), 10=lowest (trivia)';
COMMENT ON COLUMN public.quick_facts.confidence IS 'Confidence score from 0.0 to 1.0 for fact accuracy';
COMMENT ON COLUMN public.quick_facts.date_context IS 'JSON object with year, month, day for time-stamped events';
COMMENT ON COLUMN public.quick_facts.expires_at IS 'Optional expiration timestamp for facts that become outdated';
COMMENT ON COLUMN public.quick_facts.source_reference IS 'Human-readable reference to the source of this fact';