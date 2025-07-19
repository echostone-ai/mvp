-- Add photo_url support to avatar_profiles table
-- Run this script in your Supabase SQL Editor to add photo support

-- Add photo_url column to avatar_profiles table
ALTER TABLE avatar_profiles 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add comment to document the photo_url column
COMMENT ON COLUMN avatar_profiles.photo_url IS 'URL to the avatar profile photo stored in Supabase Storage';

-- Create index for photo_url queries (optional, for performance)
CREATE INDEX IF NOT EXISTS avatar_profiles_photo_url_idx ON avatar_profiles (photo_url) WHERE photo_url IS NOT NULL;

-- Verify the migration
DO $function$
BEGIN
  -- Check if photo_url column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'avatar_profiles' AND column_name = 'photo_url') THEN
    RAISE EXCEPTION 'photo_url column was not added to avatar_profiles table';
  END IF;
  
  RAISE NOTICE '✅ photo_url column added to avatar_profiles table';
  RAISE NOTICE '✅ Index created for photo_url queries';
  RAISE NOTICE '🎉 Avatar photo support is ready to use!';
END
$function$; 