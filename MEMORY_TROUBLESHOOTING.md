# Memory System Troubleshooting Guide

## Issues Identified and Fixed

### ✅ **Issue 1: Missing userId in Chat Interface**
**Problem**: The ChatInterface component wasn't receiving or passing the userId to the API, so memory operations couldn't work.

**Fixed**: 
- Updated `src/app/profile/chat/page.tsx` to pass `userId={user.id}` to ChatInterface
- Updated `src/components/ChatInterface.tsx` to accept and use the userId prop
- Updated the API call to include `userId` in the request body

### ✅ **Issue 2: Incorrect RPC Parameter Name**
**Problem**: The memory service was calling `match_memory_fragments` with `user_id` but the function expects `target_user_id`.

**Fixed**: 
- Updated `src/lib/memoryService.ts` to use `target_user_id` instead of `user_id` in the RPC call

### ⚠️ **Issue 3: Database Setup Required**
**Problem**: The memory database tables and functions need to be set up in Supabase.

**Solution**: Run the database setup (see instructions below)

## Database Setup Instructions

### Option 1: Automated Setup (Recommended)
1. Run the database check script:
   ```bash
   node check-memory-database.js
   ```

2. If the check fails, the database setup is needed. You can try the automated setup:
   ```bash
   node setup-memory-database.js
   ```

### Option 2: Manual Setup (If automated fails)
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/001_create_memory_fragments.sql`
4. Execute the SQL
5. Copy and paste the contents of `supabase/functions/match_memory_fragments.sql`
6. Execute the SQL
7. Run `node check-memory-database.js` to verify

## Testing the Memory System

### 1. Check Database Setup
```bash
node check-memory-database.js
```
You should see:
- ✅ memory_fragments table exists
- ✅ match_memory_fragments function exists  
- ✅ pgvector extension is enabled

### 2. Test the Chat Interface
1. Make sure you're logged in to the app
2. Go to `/profile/chat`
3. Start a conversation with personal information, like:
   - "I love hiking with my dog Max every weekend"
   - "My sister Sarah is getting married next month"
   - "I work as a software engineer at Google"

### 3. Check if Memories are Being Stored
After chatting, you can check the database directly in Supabase:
1. Go to Table Editor in Supabase
2. Look at the `memory_fragments` table
3. You should see new entries with your user_id

### 4. Test Memory Retrieval
In a new conversation, mention something related to your previous messages:
- "Tell me about outdoor activities" (should recall hiking)
- "What do you know about my family?" (should recall sister Sarah)

## Common Issues and Solutions

### Issue: "No memories being stored"
**Check**:
1. Are you logged in? (userId must be present)
2. Is the database set up correctly?
3. Check browser console for API errors
4. Check server logs for memory processing errors

### Issue: "Conversation resets in new browser window"
**Explanation**: This is expected behavior. Each browser session is independent. Memories are stored per user account, not per browser session.

**To test persistence**:
1. Have a conversation with personal details
2. Close the browser completely
3. Open a new browser and log in with the same account
4. Start a new conversation - it should reference your stored memories

### Issue: "Vector search not working"
**Check**:
1. Is the `match_memory_fragments` function created?
2. Is the pgvector extension enabled?
3. Check the RPC call parameters match the function signature

## Environment Variables Required

Make sure your `.env.local` file has:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

## Debug Information

### Check API Calls
Open browser DevTools → Network tab and look for:
- `/api/chat` calls should include `userId` in the request body
- Successful responses should include `memoriesUsed` if memories were found

### Check Console Logs
Look for these log messages:
- "Memory integration: { memoriesFound: X, enhancements: [...], userId: ... }"
- "Successfully stored X memory fragments for user Y"
- "Background memory processing failed" (indicates errors)

### Check Database Directly
In Supabase Table Editor:
1. `memory_fragments` table should have entries with your `user_id`
2. Each entry should have `fragment_text`, `embedding`, and `conversation_context`

## Performance Notes

- Memory extraction happens in the background after responding to avoid delays
- Memory retrieval is cached for performance
- Vector search uses semantic similarity, not exact text matching
- The system gracefully degrades if any component fails

## Next Steps

1. ✅ Run `node check-memory-database.js`
2. ✅ Set up database if needed
3. ✅ Test the chat interface with personal information
4. ✅ Verify memories are being stored in Supabase
5. ✅ Test memory retrieval in new conversations

The memory system should now work correctly! Let me know if you encounter any issues after following these steps.