-- Supabase Tables for Ultra-Fast Avatar Responses
-- Run this in your Supabase SQL Editor

-- Table 1: Optimized profiles for lightning-fast responses
CREATE TABLE IF NOT EXISTS optimized_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  core_personality TEXT NOT NULL,
  quick_facts TEXT NOT NULL,
  conversation_style TEXT NOT NULL,
  current_context TEXT NOT NULL,
  cached_at TIMESTAMP DEFAULT NOW()
);

-- Table 2: Full profiles as backup/fallback
CREATE TABLE IF NOT EXISTS full_profiles (
  id TEXT PRIMARY KEY,
  full_data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table 3: Avatar configurations for onboarding
CREATE TABLE IF NOT EXISTS avatar_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  avatar_name TEXT NOT NULL,
  heygen_avatar_id TEXT NOT NULL,
  voice_id TEXT,
  personality_prompt TEXT NOT NULL,
  quick_facts TEXT NOT NULL,
  conversation_style TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_optimized_profiles_cached_at ON optimized_profiles(cached_at);
CREATE INDEX IF NOT EXISTS idx_full_profiles_updated_at ON full_profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_avatar_configs_user_id ON avatar_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_configs_active ON avatar_configs(is_active);

-- Enable Row Level Security (optional)
ALTER TABLE optimized_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE full_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_configs ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust as needed)
CREATE POLICY "Allow read access to optimized_profiles" ON optimized_profiles FOR SELECT USING (true);
CREATE POLICY "Allow read access to full_profiles" ON full_profiles FOR SELECT USING (true);
CREATE POLICY "Allow read access to avatar_configs" ON avatar_configs FOR SELECT USING (true);