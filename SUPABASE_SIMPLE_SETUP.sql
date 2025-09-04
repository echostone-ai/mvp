-- Simple Supabase Setup for Authentic Expressions Pipeline
-- This version avoids complex DO blocks that cause syntax errors

-- Create enum types (will show error if they exist, but that's OK)
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
CREATE TABLE IF NOT EXISTS public.expression_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('user', 'avatar')),
    owner_key VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    type expression_type NOT NULL,
    tone VARCHAR(50),
    placement_hints TEXT[],
    duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 300000),
    cdn_url TEXT NOT NULL,
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 100),
    status expression_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS expression_clips_owner_idx ON public.expression_clips(owner_type, owner_key, status);
CREATE INDEX IF NOT EXISTS expression_clips_type_idx ON public.expression_clips(type, status);
CREATE INDEX IF NOT EXISTS expression_clips_priority_idx ON public.expression_clips(owner_type, owner_key, priority DESC);
CREATE INDEX IF NOT EXISTS expression_clips_created_at_idx ON public.expression_clips(created_at);

-- Enable RLS
ALTER TABLE public.expression_clips ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create trigger function
CREATE OR REPLACE FUNCTION update_expression_clips_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS update_expression_clips_updated_at ON public.expression_clips;
CREATE TRIGGER update_expression_clips_updated_at 
    BEFORE UPDATE ON public.expression_clips 
    FOR EACH ROW 
    EXECUTE FUNCTION update_expression_clips_updated_at();

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_data JSONB DEFAULT '{}'::jsonb,
    voice_id TEXT,
    voice_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles indexes
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS profiles_voice_id_idx ON public.profiles (voice_id);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at);
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles RLS policy
DROP POLICY IF EXISTS "Users can only access their own profile" ON public.profiles;
CREATE POLICY "Users can only access their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = user_id);

-- Create profile auto-creation function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Create profile auto-creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profiles updated_at function
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create profiles updated_at trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_profiles_updated_at();

-- Create profiles for existing users
INSERT INTO public.profiles (user_id, created_at, updated_at)
SELECT id, created_at, updated_at 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('expressions', 'expressions', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage RLS policies
DROP POLICY IF EXISTS "Users can upload their own expressions" ON storage.objects;
CREATE POLICY "Users can upload their own expressions" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'expressions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public read access for expressions" ON storage.objects;
CREATE POLICY "Public read access for expressions" ON storage.objects
FOR SELECT USING (bucket_id = 'expressions');

-- Add comments
COMMENT ON TABLE public.expression_clips IS 'Stores authentic expression clips for voice overlay functionality';
COMMENT ON TABLE public.profiles IS 'User profiles with settings and preferences';

-- Verification queries
SELECT 'expression_clips' as table_name, COUNT(*) as column_count FROM information_schema.columns WHERE table_name = 'expression_clips' AND table_schema = 'public'
UNION ALL
SELECT 'profiles' as table_name, COUNT(*) as column_count FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public';