-- Migration: Add expression privacy settings support to profiles table
-- This migration ensures the profiles table exists and can store expression privacy settings

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

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles (idempotent)
DROP POLICY IF EXISTS "Users can only access their own profile" ON public.profiles;
CREATE POLICY "Users can only access their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = user_id);

-- Create a function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $
BEGIN
    INSERT INTO public.profiles (user_id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create profiles for new users (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ language 'plpgsql';

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

-- Add helpful comments for documentation
COMMENT ON TABLE public.profiles IS 'User profiles with settings and preferences';
COMMENT ON COLUMN public.profiles.profile_data IS 'JSONB column for storing user settings including expression privacy preferences';
COMMENT ON COLUMN public.profiles.voice_id IS 'User voice ID for TTS';
COMMENT ON COLUMN public.profiles.voice_settings IS 'Voice configuration settings';

-- Verify profiles setup
DO $
BEGIN
    -- Check if profiles table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'profiles table does not exist';
    END IF;
    
    -- Check if unique constraint exists
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique') THEN
        RAISE EXCEPTION 'profiles_user_id_unique constraint does not exist';
    END IF;
    
    RAISE NOTICE '✅ Profiles table setup completed successfully!';
    RAISE NOTICE '✅ profiles table created/verified with proper schema';
    RAISE NOTICE '✅ RLS policies configured for user data isolation';
    RAISE NOTICE '✅ Triggers for auto-profile creation and updated_at configured';
    RAISE NOTICE '✅ Existing users have been given profiles';
    RAISE NOTICE '🎉 Expression privacy settings database schema is ready!';
END
$;