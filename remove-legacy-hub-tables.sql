-- Remove Legacy Hub tables and related data
-- Run this migration to clean up the database after removing hub functionality

-- Drop tables in correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS "Flag" CASCADE;
DROP TABLE IF EXISTS "ViewerAccess" CASCADE;
DROP TABLE IF EXISTS "Invitation" CASCADE;
DROP TABLE IF EXISTS "Memory" CASCADE;
DROP TABLE IF EXISTS "Hub" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;

-- Clean up any remaining sequences or indexes
DROP SEQUENCE IF EXISTS "Flag_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "ViewerAccess_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "Invitation_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "Memory_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "Hub_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "Notification_id_seq" CASCADE;

-- Note: This migration removes all legacy hub functionality
-- Make sure to backup any important data before running