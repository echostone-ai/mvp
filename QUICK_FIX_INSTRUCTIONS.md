# Quick Fix Instructions for Memory System

## Step 1: Enable pgvector Extension
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run this SQL command:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Step 2: Create Conversations Table
Run this SQL in your Supabase SQL Editor:
```sql
-- Create the conversations table for persistent chat history
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user-specific queries
CREATE INDEX conversations_user_id_idx ON conversations (user_id);

-- Create index for last_active queries
CREATE INDEX conversations_last_active_idx ON conversations (last_active);

-- Create composite index for user + last_active
CREATE INDEX conversations_user_last_active_idx ON conversations (user_id, last_active DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to ensure users can only access their own conversations
CREATE POLICY "Users can only access their own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Step 3: Test the Setup
Run this command to verify everything is working:
```bash
node check-memory-database.js
```

You should see all green checkmarks.

## What This Will Fix
- ✅ Memory fragments will be stored and retrieved
- ✅ Conversations will persist across browser tabs/sessions
- ✅ Long-term memory will work across conversations
- ✅ No more conversation resets when switching tabs

After completing these steps, the memory system should work correctly!