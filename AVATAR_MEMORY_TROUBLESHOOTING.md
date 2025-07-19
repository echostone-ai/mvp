# Avatar Memory System Troubleshooting

If your avatar memories aren't connecting properly, follow these steps to diagnose and fix the issue:

## Step 1: Run the Database Fix

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the contents of `fix-avatar-memory-system.sql`
4. Check the output messages to see if everything is set up correctly

## Step 2: Test the System

1. Go to `/test-avatar-memories` in your app
2. Select an avatar and run the test
3. Check if all components are working:
   - Avatar Table: Should show your avatars
   - Memory Table: Should show memories with avatar_id column
   - Vector Function: Should work with avatar isolation

## Step 3: Check the Console Logs

When chatting with an avatar, open your browser's developer console and look for these log messages:

- `🔍 Getting avatar-specific memories:` - Shows memory retrieval is starting
- `📡 Calling match_memory_fragments with params:` - Shows the database query
- `✅ Memory search successful:` - Shows memories were found
- `📝 Retrieved memories:` - Shows the final memory count

## Step 4: Common Issues and Solutions

### Issue: "No memories found for avatar"
**Cause**: The avatar hasn't had any conversations yet, or memories aren't being stored properly.
**Solution**: 
1. Have a conversation with the avatar
2. Check the console for memory storage logs
3. Verify the `/api/extract-memories` endpoint is working

### Issue: "Memory retrieval RPC error"
**Cause**: The database function isn't updated to support avatar isolation.
**Solution**: 
1. Run the `fix-avatar-memory-system.sql` script
2. Make sure the `match_memory_fragments` function has 5 parameters

### Issue: "Avatar memories mixing with other avatars"
**Cause**: The avatar_id isn't being passed correctly or stored properly.
**Solution**:
1. Check that `avatarId` is being passed in the chat API request
2. Verify that memories are being stored with the correct `avatar_id`
3. Check the database to see if `avatar_id` values are correct

### Issue: "Memories not being referenced in responses"
**Cause**: The AI isn't being instructed properly to use the memories.
**Solution**:
1. Check that the memory context prompt is being added to the system prompt
2. Verify that memories are being retrieved (check console logs)
3. Make sure the similarity threshold isn't too high (try lowering to 0.5)

## Step 5: Manual Database Check

You can manually check your database with these queries:

```sql
-- Check if avatar_profiles table exists and has data
SELECT * FROM avatar_profiles LIMIT 5;

-- Check if memory_fragments has avatar_id column
SELECT id, user_id, avatar_id, fragment_text 
FROM memory_fragments 
WHERE avatar_id IS NOT NULL 
LIMIT 5;

-- Test the vector search function
SELECT * FROM match_memory_fragments(
  array_fill(0.0, ARRAY[1536])::vector,
  0.5,
  5,
  'your-user-id-here'::uuid,
  'your-avatar-id-here'::uuid
);
```

## Step 6: Reset Avatar Memories (if needed)

If you want to start fresh with an avatar's memories:

```sql
-- Delete all memories for a specific avatar
DELETE FROM memory_fragments 
WHERE avatar_id = 'your-avatar-id-here';

-- Or delete all memories for a user-avatar pair
DELETE FROM memory_fragments 
WHERE user_id = 'your-user-id-here' 
AND avatar_id = 'your-avatar-id-here';
```

## Step 7: Contact Support

If none of these steps resolve the issue, please provide:

1. The output from the test page (`/test-avatar-memories`)
2. Console logs from a chat session
3. Your Supabase project details (without sensitive information)
4. Steps you've already tried

The avatar memory system should work once the database is properly configured and the functions are updated.