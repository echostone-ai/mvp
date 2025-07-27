-- Onboarding Sessions Table
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  current_question INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 4,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Onboarding Responses Table
CREATE TABLE IF NOT EXISTS onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES onboarding_sessions(id) ON DELETE CASCADE NOT NULL,
  avatar_id UUID REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  question TEXT NOT NULL,
  transcript TEXT,
  analysis JSONB,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, question_index)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_avatar_id ON onboarding_sessions(avatar_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_is_complete ON onboarding_sessions(is_complete);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_session_id ON onboarding_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_question_index ON onboarding_responses(question_index);

-- Row Level Security (RLS) Policies
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Users can only access their own onboarding sessions
CREATE POLICY "Users can view their own onboarding sessions" ON onboarding_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding sessions" ON onboarding_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding sessions" ON onboarding_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own onboarding sessions" ON onboarding_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only access responses from their own sessions
CREATE POLICY "Users can view their own onboarding responses" ON onboarding_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM onboarding_sessions 
      WHERE onboarding_sessions.id = onboarding_responses.session_id 
      AND onboarding_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own onboarding responses" ON onboarding_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM onboarding_sessions 
      WHERE onboarding_sessions.id = onboarding_responses.session_id 
      AND onboarding_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own onboarding responses" ON onboarding_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM onboarding_sessions 
      WHERE onboarding_sessions.id = onboarding_responses.session_id 
      AND onboarding_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own onboarding responses" ON onboarding_responses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM onboarding_sessions 
      WHERE onboarding_sessions.id = onboarding_responses.session_id 
      AND onboarding_sessions.user_id = auth.uid()
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_onboarding_sessions_updated_at 
  BEFORE UPDATE ON onboarding_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_responses_updated_at 
  BEFORE UPDATE ON onboarding_responses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();