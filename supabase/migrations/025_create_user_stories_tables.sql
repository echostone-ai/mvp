-- Migration: Create user_stories and story_usage_analytics tables for authentic voice stories
-- This migration creates the database schema for the authentic voice stories feature

-- Create enum types for story management
CREATE TYPE story_category AS ENUM (
    'memory', 
    'experience', 
    'advice', 
    'anecdote'
);

CREATE TYPE story_status AS ENUM (
    'active', 
    'inactive', 
    'processing', 
    'failed'
);

-- Create the user_stories table
CREATE TABLE public.user_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id VARCHAR(255) NOT NULL,
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('user', 'avatar')),
    title VARCHAR(255) NOT NULL,
    category story_category NOT NULL,
    triggers TEXT NOT NULL, -- Comma-separated keywords (max 20), normalized lowercase
    audio_url TEXT NOT NULL,
    duration_ms INTEGER NOT NULL CHECK (duration_ms BETWEEN 30000 AND 300000), -- 30s to 5min
    transcript TEXT,
    priority INTEGER DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
    status story_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the story_usage_analytics table for tracking
CREATE TABLE public.story_usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES public.user_stories(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    trigger_text TEXT,
    matched_keywords TEXT[],
    confidence_score DECIMAL(3,2),
    played_successfully BOOLEAN DEFAULT FALSE,
    playback_duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX user_stories_owner_idx ON public.user_stories(owner_type, owner_id, status);
CREATE INDEX user_stories_triggers_text_idx ON public.user_stories USING gin(to_tsvector('english', triggers));
CREATE INDEX user_stories_priority_idx ON public.user_stories(priority DESC, status);
CREATE INDEX user_stories_category_idx ON public.user_stories(category, status);
CREATE INDEX user_stories_created_at_idx ON public.user_stories(created_at);

-- Analytics table indexes
CREATE INDEX story_usage_analytics_story_id_idx ON public.story_usage_analytics(story_id);
CREATE INDEX story_usage_analytics_session_id_idx ON public.story_usage_analytics(session_id);
CREATE INDEX story_usage_analytics_created_at_idx ON public.story_usage_analytics(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_usage_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to manage their own stories
CREATE POLICY "Users can manage their own stories" ON public.user_stories
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
    );

-- Create RLS policy for service role to manage avatar stories
CREATE POLICY "Service role can manage avatar stories" ON public.user_stories
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        (owner_type = 'avatar' AND auth.role() = 'authenticated')
    );

-- Create RLS policy for public read access to active stories
CREATE POLICY "Public read access for active stories" ON public.user_stories
    FOR SELECT USING (status = 'active');

-- Analytics table RLS policies
CREATE POLICY "Users can view their own story analytics" ON public.story_usage_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_stories 
            WHERE user_stories.id = story_usage_analytics.story_id 
            AND ((owner_type = 'user' AND owner_id = auth.uid()::text) OR auth.role() = 'service_role')
        )
    );

CREATE POLICY "Service role can insert analytics" ON public.story_usage_analytics
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create trigger function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_stories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_user_stories_updated_at 
    BEFORE UPDATE ON public.user_stories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_stories_updated_at();

-- Create function to enforce 5-story limit per avatar (database-level constraint)
CREATE OR REPLACE FUNCTION check_story_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.user_stories 
        WHERE owner_id = NEW.owner_id 
        AND owner_type = NEW.owner_type 
        AND status IN ('active', 'inactive', 'processing')) >= 5 THEN
        RAISE EXCEPTION 'Maximum of 5 stories allowed per avatar. Current count: %', 
            (SELECT COUNT(*) FROM public.user_stories 
             WHERE owner_id = NEW.owner_id 
             AND owner_type = NEW.owner_type 
             AND status IN ('active', 'inactive', 'processing'));
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to enforce story limit
CREATE TRIGGER enforce_story_limit 
    BEFORE INSERT ON public.user_stories 
    FOR EACH ROW 
    EXECUTE FUNCTION check_story_limit();

-- Add helpful comments for documentation
COMMENT ON TABLE public.user_stories IS 'Stores authentic voice story recordings for avatar storytelling';
COMMENT ON COLUMN public.user_stories.owner_id IS 'User ID or avatar identifier who owns the story';
COMMENT ON COLUMN public.user_stories.owner_type IS 'Type of owner: user or avatar';
COMMENT ON COLUMN public.user_stories.title IS 'Human-readable title for the story';
COMMENT ON COLUMN public.user_stories.category IS 'Story category for organization and matching';
COMMENT ON COLUMN public.user_stories.triggers IS 'Comma-separated keywords that trigger this story';
COMMENT ON COLUMN public.user_stories.audio_url IS 'CDN URL for the story audio file';
COMMENT ON COLUMN public.user_stories.duration_ms IS 'Duration in milliseconds (30s-5min)';
COMMENT ON COLUMN public.user_stories.transcript IS 'Optional transcript text for accessibility and search';
COMMENT ON COLUMN public.user_stories.priority IS 'Priority level: 0=lowest, 100=highest';
COMMENT ON COLUMN public.user_stories.status IS 'Current status of the story';

COMMENT ON TABLE public.story_usage_analytics IS 'Tracks story usage and performance analytics';
COMMENT ON COLUMN public.story_usage_analytics.story_id IS 'Reference to the story that was triggered';
COMMENT ON COLUMN public.story_usage_analytics.session_id IS 'Session identifier for grouping analytics';
COMMENT ON COLUMN public.story_usage_analytics.trigger_text IS 'The text that triggered the story';
COMMENT ON COLUMN public.story_usage_analytics.matched_keywords IS 'Keywords that matched from the trigger text';
COMMENT ON COLUMN public.story_usage_analytics.confidence_score IS 'Confidence score of the match (0.00-1.00)';
COMMENT ON COLUMN public.story_usage_analytics.played_successfully IS 'Whether the story played without errors';
COMMENT ON COLUMN public.story_usage_analytics.playback_duration_ms IS 'How long the story actually played';
COMMENT ON COLUMN public.story_usage_analytics.error_message IS 'Error message if playback failed';

-- Verify user_stories setup
DO $$
BEGIN
  -- Check if user_stories table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_stories') THEN
    RAISE EXCEPTION 'user_stories table does not exist';
  END IF;
  
  -- Check if story_usage_analytics table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'story_usage_analytics') THEN
    RAISE EXCEPTION 'story_usage_analytics table does not exist';
  END IF;
  
  -- Check if enum types exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_category') THEN
    RAISE EXCEPTION 'story_category enum does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_status') THEN
    RAISE EXCEPTION 'story_status enum does not exist';
  END IF;
  
  RAISE NOTICE '✅ User stories tables setup completed successfully!';
  RAISE NOTICE '✅ user_stories table created with 5-story limit constraint';
  RAISE NOTICE '✅ story_usage_analytics table created for tracking';
  RAISE NOTICE '✅ Enum types created: story_category, story_status';
  RAISE NOTICE '✅ Indexes and RLS policies configured';
  RAISE NOTICE '✅ Triggers for updated_at timestamp and story limits configured';
  RAISE NOTICE '🎉 Authentic voice stories database schema is ready!';
END
$$;