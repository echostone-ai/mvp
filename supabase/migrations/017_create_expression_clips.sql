-- Migration: Create expression_clips table for authentic expressions pipeline
-- This table stores user and avatar expression clips for voice overlay functionality

-- Create enum types for expression management
CREATE TYPE expression_type AS ENUM (
    'laugh', 
    'sigh', 
    'breath', 
    'affirmation', 
    'greeting', 
    'catchphrase', 
    'filler'
);

CREATE TYPE expression_status AS ENUM (
    'active', 
    'inactive', 
    'processing', 
    'failed'
);

-- Create the expression_clips table
CREATE TABLE public.expression_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('user', 'avatar')),
    owner_key VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    type expression_type NOT NULL,
    tone VARCHAR(50),
    placement_hints TEXT[],
    duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 300000), -- Max 5 minutes
    cdn_url TEXT NOT NULL,
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 100),
    status expression_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX expression_clips_owner_idx ON public.expression_clips(owner_type, owner_key, status);
CREATE INDEX expression_clips_type_idx ON public.expression_clips(type, status);
CREATE INDEX expression_clips_priority_idx ON public.expression_clips(owner_type, owner_key, priority DESC);
CREATE INDEX expression_clips_created_at_idx ON public.expression_clips(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.expression_clips ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to manage their own expressions
CREATE POLICY "Users can manage their own expressions" ON public.expression_clips
    FOR ALL USING (
        owner_type = 'user' AND owner_key = auth.uid()::text
    );

-- Create RLS policy for service role to manage avatar expressions
CREATE POLICY "Service role can manage avatar expressions" ON public.expression_clips
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        (owner_type = 'avatar' AND auth.role() = 'authenticated')
    );

-- Create RLS policy for public read access to active expressions
CREATE POLICY "Public read access for active expressions" ON public.expression_clips
    FOR SELECT USING (status = 'active');

-- Create trigger function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_expression_clips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_expression_clips_updated_at 
    BEFORE UPDATE ON public.expression_clips 
    FOR EACH ROW 
    EXECUTE FUNCTION update_expression_clips_updated_at();

-- Add helpful comments for documentation
COMMENT ON TABLE public.expression_clips IS 'Stores authentic expression clips for voice overlay functionality';
COMMENT ON COLUMN public.expression_clips.owner_type IS 'Type of owner: user or avatar';
COMMENT ON COLUMN public.expression_clips.owner_key IS 'User ID or avatar identifier';
COMMENT ON COLUMN public.expression_clips.type IS 'Type of expression for contextual matching';
COMMENT ON COLUMN public.expression_clips.tone IS 'Optional tone descriptor for expression selection';
COMMENT ON COLUMN public.expression_clips.placement_hints IS 'Array of hints for when to use this expression';
COMMENT ON COLUMN public.expression_clips.duration_ms IS 'Duration in milliseconds for scheduling calculations';
COMMENT ON COLUMN public.expression_clips.cdn_url IS 'CDN URL for optimized audio delivery';
COMMENT ON COLUMN public.expression_clips.priority IS 'Priority level: 0=lowest, 100=highest';
COMMENT ON COLUMN public.expression_clips.status IS 'Current status of the expression clip';

-- Verify expression_clips setup
DO $$
BEGIN
  -- Check if expression_clips table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expression_clips') THEN
    RAISE EXCEPTION 'expression_clips table does not exist';
  END IF;
  
  -- Check if enum types exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expression_type') THEN
    RAISE EXCEPTION 'expression_type enum does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expression_status') THEN
    RAISE EXCEPTION 'expression_status enum does not exist';
  END IF;
  
  RAISE NOTICE '✅ Expression clips table setup completed successfully!';
  RAISE NOTICE '✅ expression_clips table created with proper schema';
  RAISE NOTICE '✅ Enum types created: expression_type, expression_status';
  RAISE NOTICE '✅ Indexes and RLS policies configured';
  RAISE NOTICE '✅ Triggers for updated_at timestamp configured';
  RAISE NOTICE '🎉 Authentic expressions pipeline database schema is ready!';
END
$$;