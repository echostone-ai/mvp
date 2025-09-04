-- Complete Supabase Setup for Authentic Expressions Pipeline
-- This script is idempotent and can be run multiple times safely

-- Create enum types for expression management (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expression_type') THEN
        CREATE TYPE expression_type AS ENUM (
            'laugh', 
            'sigh', 
            'breath', 
            'affirmation', 
            'greeting', 
            'catchphrase', 
            'filler'
        );
        RAISE NOTICE '✅ Created expression_type enum';
    ELSE
        RAISE NOTICE '⚠️  expression_type enum already exists, skipping';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expression_status') THEN
        CREATE TYPE expression_status AS ENUM (
            'active', 
            'inactive', 
            'processing', 
            'failed'
        );
        RAISE NOTICE '✅ Created expression_status enum';
    ELSE
        RAISE NOTICE '⚠️  expression_status enum already exists, skipping';
    END IF;
END $$;

-- Create the expression_clips table (idempotent)
CREATE TABLE IF NOT EXISTS public.expression_clips (
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

-- Create indexes for performance optimization (idempotent)
CREATE INDEX IF NOT EXISTS expression_clips_owner_idx ON public.expression_clips(owner_type, owner_key, status);
CREATE INDEX IF NOT EXISTS expression_clips_type_idx ON public.expression_clips(type, status);
CREATE INDEX IF NOT EXISTS expression_clips_priority_idx ON public.expression_clips(owner_type, owner_key, priority DESC);
CREATE INDEX IF NOT EXISTS expression_clips_created_at_idx ON public.expression_clips(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.expression_clips ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (idempotent)
DROP POLICY IF EXISTS "Users can manage their own expressions" ON public.expression_clips;
CREATE POLICY "Users can manage their own expressions" ON public.expression_clips
    FOR ALL USING (
        owner_type = 'user' AND owner_key = auth.uid()::text
    );

DROP POLICY IF EXISTS "Service role can manage avatar expressions" ON public.expression_clips;
CREATE POLICY "Service role can manage avatar expressions" ON public.expression_clips
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        (owner_type = 'avatar' AND auth.role() = 'authenticated')
    );

DROP POLICY IF EXISTS "Public read access for active expressions" ON public.expression_clips;
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

-- Create trigger to automatically update the updated_at column (idempotent)
DROP TRIGGER IF EXISTS update_expression_clips_updated_at ON public.expression_clips;
CREATE TRIGGER update_expression_clips_updated_at 
    BEFORE UPDATE ON public.expression_clips 
    FOR EACH ROW 
    EXECUTE FUNCTION update_expression_clips_updated_at();

-- Create profiles table if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_data JSONB DEFAULT '{}'::jsonb,
    voice_id TEXT,
    voice_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id to ensure one profile per user (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles (user_id);

-- Create indexes for better performance (idempotent)
CREATE INDEX IF NOT EXISTS profiles_voice_id_idx ON public.profiles (voice_id);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at);
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at);

-- Enable Row Level Security (RLS) for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles (idempotent)
DROP POLICY IF EXISTS "Users can only access their own profile" ON public.profiles;
CREATE POLICY "Users can only access their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = user_id);

-- Create a function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create profiles for new users (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update the updated_at timestamp for profiles
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column (idempotent)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_profiles_updated_at();

-- Update existing users who might not have profiles
INSERT INTO public.profiles (user_id, created_at, updated_at)
SELECT id, created_at, updated_at 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Create storage bucket for expressions (idempotent)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('expressions', 'expressions', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for storage (idempotent)
DROP POLICY IF EXISTS "Users can upload their own expressions" ON storage.objects;
CREATE POLICY "Users can upload their own expressions" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'expressions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public read access for expressions" ON storage.objects;
CREATE POLICY "Public read access for expressions" ON storage.objects
FOR SELECT USING (bucket_id = 'expressions');

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

COMMENT ON TABLE public.profiles IS 'User profiles with settings and preferences';
COMMENT ON COLUMN public.profiles.profile_data IS 'JSONB column for storing user settings including expression privacy preferences';
COMMENT ON COLUMN public.profiles.voice_id IS 'User voice ID for TTS';
COMMENT ON COLUMN public.profiles.voice_settings IS 'Voice configuration settings';

-- Final verification and success message
DO $
BEGIN
    -- Check if expression_clips table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expression_clips' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'expression_clips table does not exist after setup';
    END IF;
    
    -- Check if profiles table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'profiles table does not exist after setup';
    END IF;
    
    -- Check if enum types exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expression_type') THEN
        RAISE EXCEPTION 'expression_type enum does not exist after setup';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expression_status') THEN
        RAISE EXCEPTION 'expression_status enum does not exist after setup';
    END IF;
    
    -- Check if storage bucket exists
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'expressions') THEN
        RAISE EXCEPTION 'expressions storage bucket does not exist after setup';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ================================';
    RAISE NOTICE '🎉 SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '🎉 ================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ expression_clips table created with proper schema';
    RAISE NOTICE '✅ profiles table created/verified with privacy settings support';
    RAISE NOTICE '✅ Enum types: expression_type, expression_status';
    RAISE NOTICE '✅ Performance indexes created';
    RAISE NOTICE '✅ RLS policies configured for data security';
    RAISE NOTICE '✅ Triggers for automatic timestamp updates';
    RAISE NOTICE '✅ Storage bucket "expressions" created';
    RAISE NOTICE '✅ Storage RLS policies configured';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Your Authentic Expressions Pipeline database is ready!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Set environment variables (see SUPABASE_DEPLOYMENT_GUIDE.md)';
    RAISE NOTICE '2. Deploy your application with FEATURE_VOICE_OVERLAYS=false';
    RAISE NOTICE '3. Test the infrastructure';
    RAISE NOTICE '4. Gradually enable the feature flag';
    RAISE NOTICE '';
END
$;

-- Show table information for verification
SELECT 
    'expression_clips' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'expression_clips' AND table_schema = 'public'

UNION ALL

SELECT 
    'profiles' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public';

-- Show enum values for verification
SELECT 
    'expression_type' as enum_name,
    STRING_AGG(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_enum 
WHERE enumtypid = 'expression_type'::regtype

UNION ALL

SELECT 
    'expression_status' as enum_name,
    STRING_AGG(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_enum 
WHERE enumtypid = 'expression_status'::regtype;

-- Show RLS policies for verification
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd as command,
    CASE WHEN qual IS NOT NULL THEN 'Has conditions' ELSE 'No conditions' END as conditions
FROM pg_policies 
WHERE tablename IN ('expression_clips', 'profiles')
ORDER BY tablename, policyname;