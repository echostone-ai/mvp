-- Script to fix existing memories that don't have avatar_id set
-- This will assign all existing memories without avatar_id to a specific avatar

-- First, check how many memories don't have avatar_id set
SELECT COUNT(*) FROM memory_fragments WHERE avatar_id IS NULL;

-- Option 1: Assign all existing memories to a specific avatar
-- Replace 'YOUR_AVATAR_ID_HERE' with the ID of the avatar you want to assign these memories to
UPDATE memory_fragments 
SET avatar_id = 'YOUR_AVATAR_ID_HERE'
WHERE avatar_id IS NULL;

-- Option 2: Delete all memories that don't have an avatar_id
-- Uncomment the line below if you want to delete all unassigned memories instead
-- DELETE FROM memory_fragments WHERE avatar_id IS NULL;

-- Verify the update
SELECT COUNT(*) FROM memory_fragments WHERE avatar_id IS NULL;