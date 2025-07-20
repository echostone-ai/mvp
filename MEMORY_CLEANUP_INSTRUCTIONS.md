# Memory Cleanup Instructions

Since you're experiencing issues with existing memories not being properly associated with avatars, here are a few options to clean up your database:

## Option 1: Assign Existing Memories to a Specific Avatar

If you want to keep your existing memories and assign them all to one avatar:

1. Open the Supabase SQL Editor
2. Edit the `fix-existing-memories.sql` script to replace `YOUR_AVATAR_ID_HERE` with the ID of the avatar you want to assign memories to
3. Run the script

```sql
-- Replace 'YOUR_AVATAR_ID_HERE' with the ID of your preferred avatar
UPDATE memory_fragments 
SET avatar_id = 'YOUR_AVATAR_ID_HERE'
WHERE avatar_id IS NULL;
```

## Option 2: Delete All Unassigned Memories

If you want to delete only the memories that don't have an avatar assigned:

```sql
DELETE FROM memory_fragments WHERE avatar_id IS NULL;
```

## Option 3: Flush All Memories (Clean Slate)

If you want to start fresh and delete all memories:

```sql
DELETE FROM memory_fragments;
```

## How to Get Your Avatar IDs

To find the ID of your avatars:

```sql
SELECT id, name FROM avatar_profiles;
```

## Troubleshooting

If you're still having issues with the memory management UI:

1. Make sure you've applied all the code changes
2. Check the browser console for any errors
3. Verify that the `avatar_id` column was added to the `memory_fragments` table:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memory_fragments';
```

4. Check if the memories are being properly filtered by avatar:

```sql
-- Replace with your user ID and avatar ID
SELECT * FROM memory_fragments 
WHERE user_id = 'YOUR_USER_ID' 
AND avatar_id = 'YOUR_AVATAR_ID';
```

## After Cleanup

After cleaning up the database, try using the memory management UI again. Each avatar should now have its own isolated set of memories, and the delete functionality should work properly.