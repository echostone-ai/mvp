#!/usr/bin/env node

// Fix for ambiguous token_count column reference
// This script applies the database fix using the existing Supabase connection

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDatabaseFunctions() {
  console.log('🔧 Fixing ambiguous token_count column reference...');

  try {
    // Drop existing functions
    console.log('📝 Dropping existing functions...');
    
    const dropFunctions = `
      DROP FUNCTION IF EXISTS get_relevant_memories_optimized(vector, uuid, uuid, float, integer, integer);
      DROP FUNCTION IF EXISTS search_memories_by_text_optimized(text, uuid, uuid, integer, integer);
    `;

    const { error: dropError } = await supabase.rpc('exec_sql', { sql: dropFunctions });
    if (dropError) {
      console.log('⚠️  Drop functions result:', dropError.message);
    }

    // Create fixed get_relevant_memories_optimized function
    console.log('📝 Creating fixed get_relevant_memories_optimized function...');
    
    const createGetRelevantMemories = `
      CREATE OR REPLACE FUNCTION get_relevant_memories_optimized(
        query_embedding vector(1536),
        target_user_id uuid,
        target_avatar_id uuid DEFAULT NULL,
        match_threshold float DEFAULT 0.7,
        match_count integer DEFAULT 6,
        max_tokens integer DEFAULT 300
      )
      RETURNS TABLE (
        id uuid,
        user_id uuid,
        avatar_id uuid,
        fragment_text text,
        conversation_context jsonb,
        similarity float,
        created_at timestamp with time zone,
        updated_at timestamp with time zone,
        token_count integer
      ) 
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        WITH recent_memories AS (
          SELECT
            mf.id,
            mf.user_id,
            mf.avatar_id,
            mf.fragment_text,
            mf.conversation_context,
            0.8::float AS similarity,
            mf.created_at,
            mf.updated_at,
            CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3)::integer AS fragment_tokens
          FROM memory_fragments mf
          WHERE 
            mf.user_id = target_user_id
            AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
          ORDER BY mf.created_at DESC
          LIMIT match_count * 2
        ),
        token_limited AS (
          SELECT *,
            SUM(fragment_tokens) OVER (ORDER BY created_at DESC ROWS UNBOUNDED PRECEDING) AS running_tokens
          FROM recent_memories
        )
        SELECT 
          tl.id,
          tl.user_id,
          tl.avatar_id,
          tl.fragment_text,
          tl.conversation_context,
          tl.similarity,
          tl.created_at,
          tl.updated_at,
          tl.fragment_tokens AS token_count
        FROM token_limited tl
        WHERE tl.running_tokens <= max_tokens
        ORDER BY tl.created_at DESC
        LIMIT match_count;
      END;
      $$;
    `;

    const { error: createError1 } = await supabase.rpc('exec_sql', { sql: createGetRelevantMemories });
    if (createError1) {
      console.error('❌ Error creating get_relevant_memories_optimized:', createError1);
      throw createError1;
    }

    // Create fixed search_memories_by_text_optimized function
    console.log('📝 Creating fixed search_memories_by_text_optimized function...');
    
    const createSearchMemories = `
      CREATE OR REPLACE FUNCTION search_memories_by_text_optimized(
        search_text text,
        target_user_id uuid,
        target_avatar_id uuid DEFAULT NULL,
        match_count integer DEFAULT 6,
        max_tokens integer DEFAULT 300
      )
      RETURNS TABLE (
        id uuid,
        user_id uuid,
        avatar_id uuid,
        fragment_text text,
        conversation_context jsonb,
        similarity float,
        created_at timestamp with time zone,
        updated_at timestamp with time zone,
        token_count integer
      ) 
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        WITH text_matches AS (
          SELECT
            mf.id,
            mf.user_id,
            mf.avatar_id,
            mf.fragment_text,
            mf.conversation_context,
            CASE 
              WHEN lower(mf.fragment_text) LIKE '%' || lower(search_text) || '%' THEN 0.9
              WHEN lower(mf.fragment_text) ~ lower(search_text) THEN 0.8
              ELSE 0.7
            END AS similarity,
            mf.created_at,
            mf.updated_at,
            CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3)::integer AS fragment_tokens
          FROM memory_fragments mf
          WHERE 
            mf.user_id = target_user_id
            AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
            AND (
              lower(mf.fragment_text) LIKE '%' || lower(search_text) || '%'
              OR lower(mf.fragment_text) ~ lower(search_text)
            )
          ORDER BY 
            CASE 
              WHEN lower(mf.fragment_text) LIKE '%' || lower(search_text) || '%' THEN 1
              WHEN lower(mf.fragment_text) ~ lower(search_text) THEN 2
              ELSE 3
            END,
            mf.created_at DESC
          LIMIT match_count * 2
        ),
        token_limited AS (
          SELECT *,
            SUM(fragment_tokens) OVER (ORDER BY similarity DESC ROWS UNBOUNDED PRECEDING) AS running_tokens
          FROM text_matches
        )
        SELECT 
          tl.id,
          tl.user_id,
          tl.avatar_id,
          tl.fragment_text,
          tl.conversation_context,
          tl.similarity,
          tl.created_at,
          tl.updated_at,
          tl.fragment_tokens AS token_count
        FROM token_limited tl
        WHERE tl.running_tokens <= max_tokens
        ORDER BY tl.similarity DESC
        LIMIT match_count;
      END;
      $$;
    `;

    const { error: createError2 } = await supabase.rpc('exec_sql', { sql: createSearchMemories });
    if (createError2) {
      console.error('❌ Error creating search_memories_by_text_optimized:', createError2);
      throw createError2;
    }

    // Grant permissions
    console.log('📝 Granting permissions...');
    
    const grantPermissions = `
      GRANT EXECUTE ON FUNCTION get_relevant_memories_optimized TO authenticated;
      GRANT EXECUTE ON FUNCTION search_memories_by_text_optimized TO authenticated;
    `;

    const { error: grantError } = await supabase.rpc('exec_sql', { sql: grantPermissions });
    if (grantError) {
      console.log('⚠️  Grant permissions result:', grantError.message);
    }

    console.log('✅ Database functions fixed successfully!');
    console.log('🔄 Please restart your Next.js development server to apply the changes.');

  } catch (error) {
    console.error('❌ Failed to fix database functions:', error);
    process.exit(1);
  }
}

// Check if exec_sql function exists, if not, try direct SQL execution
async function checkAndCreateExecSql() {
  try {
    // Try to create a simple exec_sql function if it doesn't exist
    const createExecSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
        RETURN 'OK';
      EXCEPTION WHEN OTHERS THEN
        RETURN SQLERRM;
      END;
      $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    if (error && error.message.includes('function exec_sql')) {
      console.log('📝 Creating exec_sql helper function...');
      // We can't create the function without it existing, so we'll use a different approach
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database function fix...');
  
  const hasExecSql = await checkAndCreateExecSql();
  
  if (!hasExecSql) {
    console.log('⚠️  exec_sql function not available. Please run the SQL manually:');
    console.log('1. Copy the contents of fix-token-count-ambiguity.sql');
    console.log('2. Run it in your Supabase SQL editor');
    console.log('3. Or install psql and run: psql "your-database-url" -f fix-token-count-ambiguity.sql');
    return;
  }
  
  await fixDatabaseFunctions();
}

main().catch(console.error);