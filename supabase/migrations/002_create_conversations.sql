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