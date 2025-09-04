-- Migration: Add primary_avatar_id to profiles for onboarding default avatar

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS primary_avatar_id UUID REFERENCES public.avatar_profiles(id);

CREATE INDEX IF NOT EXISTS profiles_primary_avatar_idx ON public.profiles(primary_avatar_id);

COMMENT ON COLUMN public.profiles.primary_avatar_id IS 'The user\'s default avatar used in onboarding and chat.';

