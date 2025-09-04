-- Step-by-Step Supabase Setup for Authentic Expressions Pipeline
-- Run each section separately in your Supabase SQL Editor

-- ========================================
-- STEP 1: Create Enum Types (if needed)
-- ========================================

-- Check and create expression_type enum
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
        RAISE NOTICE 'Created expression_type enum';
    ELSE
        RAISE NOTICE 'expression_type enum already exists';
    END IF;
END $$;

-- Check and create expression_status enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expression_status') THEN
        CREATE TYPE expression_status AS ENUM (
            'active', 
            'inactive', 
            'processing', 
            'failed'
        );
        RAISE NOTICE 'Created expression_status enum';
    ELSE
        RAISE NOTICE 'expression_status enum already exists';
    END IF;
END $$;
--
 ========================================
-- STEP 2: Create Expression Clips Table
-- ========================================

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

-- ========================================
-- STEP 3: Create Indexes
-- ========================================

CREATE INDEX IF NOT EXISTS expression_clips_owner_idx ON public.expression_clips(owner_type, owner_key, status);
CREATE INDEX IF NOT EXISTS expression_clips_type_idx ON public.expression_clips(type, status);
CREATE INDEX IF NOT EXISTS expression_clips_priority_idx ON public.expression_clips(owner_type, owner_key, priority DESC);
CREATE INDEX IF NOT EXISTS expression_clips_created_at_idx ON public.expression_clips(created_at);

-- ========================================
-- STEP 4: Enable RLS and Create Policies
-- ========================================

ALTER TABLE public.expression_clips ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own expressions" ON public.expression_clips;
DROP POLICY IF EXISTS "Service role can manage avatar expressions" ON public.expression_clips;
DROP POLICY IF EXISTS "Public read access for active expressions" ON public.expression_clips;

-- Create new policies
CREATE POLICY "Users can manage their own expressions" ON public.expression_clips
    FOR ALL USING (
        owner_type = 'user' AND owner_key = auth.uid()::text
    );

CREATE POLICY "Service role can manage avatar expressions" ON public.expression_clips
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        (owner_type = 'avatar' AND auth.role() = 'authenticated')
    );

CREATE POLICY "Public read access for active expressions" ON public.expression_clips
    FOR SELECT USING (status = 'active');-
- ========================================
-- STEP 5: Create Trigger Functions
-- ========================================

CREATE OR REPLACE FUNCTION update_expression_clips_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ========================================
-- STEP 6: Create Triggers
-- ========================================

DROP TRIGGER IF EXISTS update_expression_clips_updated_at ON public.expression_clips;
CREATE TRIGGER update_expression_clips_updated_at 
    BEFORE UPDATE ON public.expression_clips 
    FOR EACH ROW 
    EXECUTE FUNCTION update_expression_clips_updated_at();

-- ========================================
-- STEP 7: Create/Update Profiles Table
-- ========================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_data JSONB DEFAULT '{}'::jsonb,
    voice_id TEXT,
    voice_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- STEP 8: Create Profiles Indexes
-- ========================================

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS profiles_voice_id_idx ON public.profiles (voice_id);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles (created_at);
CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at);

-- ========================================
-- STEP 9: Profiles RLS and Policies
-- ========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own profile" ON public.profiles;
CREATE POLICY "Users can only access their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = user_id);-- 
========================================
-- STEP 10: Profile Auto-Creation Function
-- ========================================

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

-- ========================================
-- STEP 11: Profile Auto-Creation Trigger
-- ========================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- STEP 12: Profile Updated At Function
-- ========================================

CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ========================================
-- STEP 13: Profile Updated At Trigger
-- ========================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_profiles_updated_at();

-- ========================================
-- STEP 14: Create Profiles for Existing Users
-- ========================================

INSERT INTO public.profiles (user_id, created_at, updated_at)
SELECT id, created_at, updated_at 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.profiles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;-- =
=======================================
-- STEP 15: Create Storage Bucket
-- ========================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('expressions', 'expressions', true)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- STEP 16: Storage RLS Policies
-- ========================================

DROP POLICY IF EXISTS "Users can upload their own expressions" ON storage.objects;
CREATE POLICY "Users can upload their own expressions" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'expressions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public read access for expressions" ON storage.objects;
CREATE POLICY "Public read access for expressions" ON storage.objects
FOR SELECT USING (bucket_id = 'expressions');

-- ========================================
-- STEP 17: Add Comments
-- ========================================

COMMENT ON TABLE public.expression_clips IS 'Stores authentic expression clips for voice overlay functionality';
COMMENT ON TABLE public.profiles IS 'User profiles with settings and preferences';

-- ========================================
-- STEP 18: Verification Queries
-- ========================================

-- Check tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM (VALUES ('expression_clips'), ('profiles')) AS t(table_name);

-- Check enum types
SELECT 
    typname as enum_name,
    (SELECT STRING_AGG(enumlabel, ', ' ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = t.oid) as values
FROM pg_type t
WHERE typname IN ('expression_type', 'expression_status');

-- Check RLS policies
SELECT 
    tablename, 
    policyname, 
    cmd as command
FROM pg_policies 
WHERE tablename IN ('expression_clips', 'profiles')
ORDER BY tablename, policyname;

-- Check storage bucket
SELECT id, name, public FROM storage.buckets WHERE id = 'expressions';

-- Success message
SELECT '🎉 Setup Complete! Your Authentic Expressions Pipeline database is ready!' as status;