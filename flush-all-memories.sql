-- WARNING: This script will delete ALL memories from the database
-- Use with caution!

-- First, check how many memories exist
SELECT COUNT(*) FROM memory_fragments;

-- Delete all memories
DELETE FROM memory_fragments;

-- Verify deletion
SELECT COUNT(*) FROM memory_fragments;