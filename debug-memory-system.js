// debug-memory-system.js
// Comprehensive debug script to identify ALL memory system issues

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 COMPREHENSIVE MEMORY SYSTEM DEBUG\n');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

async function debugMemorySystem() {
  console.log('Environment Check:');
  console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Present' : '❌ Missing');
  console.log('- SUPABASE_ANON_KEY:', supabaseKey ? '✅ Present' : '❌ Missing');
  console.log('- SUPABASE_SERVICE_KEY:', serviceKey ? '✅ Present' : '❌ Missing');
  console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Present' : '❌ Missing');
  console.log('');

  // Test 1: Check pgvector extension
  console.log('1. 🧪 Testing pgvector extension...');
  try {
    // Try multiple ways to check pgvector
    const { data: extensions, error: extError } = await supabase
      .rpc('exec_sql', { sql: "SELECT extname FROM pg_extension WHERE extname = 'vector';" })
      .catch(() => ({ data: null, error: 'RPC not available' }));

    if (extError || !extensions) {
      console.log('❌ pgvector extension NOT enabled');
      console.log('🔧 CRITICAL: You MUST run this SQL in Supabase SQL Editor:');
      console.log('   CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('');
    } else {
      console.log('✅ pgvector extension is enabled');
    }
  } catch (error) {
    console.log('❌ Cannot check pgvector extension:', error.message);
  }

  // Test 2: Check table permissions
  console.log('2. 🧪 Testing table permissions...');
  try {
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.log('❌ memory_fragments table access failed:', error.message);
      if (error.message.includes('permission denied')) {
        console.log('🔧 ISSUE: Row Level Security (RLS) problem');
        console.log('   Check if RLS policies are correctly set up');
      }
    } else {
      console.log('✅ memory_fragments table accessible');
    }
  } catch (error) {
    console.log('❌ Table access error:', error.message);
  }

  // Test 3: Check RLS policies
  console.log('3. 🧪 Testing RLS policies...');
  try {
    // Try to insert a test record (will fail if RLS is wrong)
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const { data, error } = await supabase
      .from('memory_fragments')
      .insert({
        user_id: testUserId,
        fragment_text: 'Test fragment',
        embedding: new Array(1536).fill(0.1),
        conversation_context: { test: true }
      })
      .select();

    if (error) {
      console.log('❌ RLS policy issue:', error.message);
      if (error.message.includes('new row violates row-level security')) {
        console.log('🔧 ISSUE: RLS policy prevents inserts');
        console.log('   The policy might require authenticated users');
      }
    } else {
      console.log('✅ RLS policies allow inserts');
      // Clean up test record
      await supabase
        .from('memory_fragments')
        .delete()
        .eq('user_id', testUserId);
    }
  } catch (error) {
    console.log('❌ RLS test error:', error.message);
  }

  // Test 4: Check vector search function
  console.log('4. 🧪 Testing vector search function...');
  try {
    const testUserId = '12345678-1234-1234-1234-123456789012'; // Valid UUID format
    const { data, error } = await supabase.rpc('match_memory_fragments', {
      query_embedding: new Array(1536).fill(0.1),
      match_threshold: 0.5,
      match_count: 1,
      target_user_id: testUserId
    });

    if (error) {
      console.log('❌ Vector search function failed:', error.message);
      if (error.message.includes('vector')) {
        console.log('🔧 ISSUE: pgvector extension not enabled');
      }
    } else {
      console.log('✅ Vector search function works');
    }
  } catch (error) {
    console.log('❌ Vector search error:', error.message);
  }

  // Test 5: Check OpenAI API
  console.log('5. 🧪 Testing OpenAI API...');
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OpenAI API key missing');
  } else {
    try {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'test',
        encoding_format: 'float',
      });

      if (response.data?.[0]?.embedding) {
        console.log('✅ OpenAI API works');
      } else {
        console.log('❌ OpenAI API response invalid');
      }
    } catch (error) {
      console.log('❌ OpenAI API failed:', error.message);
      if (error.message.includes('quota')) {
        console.log('🔧 ISSUE: OpenAI quota exceeded');
      } else if (error.message.includes('key')) {
        console.log('🔧 ISSUE: Invalid OpenAI API key');
      }
    }
  }

  // Test 6: Check auth context
  console.log('6. 🧪 Testing auth context...');
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.log('❌ No authenticated user in this context');
      console.log('🔧 NOTE: This is expected for server-side testing');
      console.log('   Memory operations require authenticated users');
    } else {
      console.log('✅ Authenticated user found:', user.id);
    }
  } catch (error) {
    console.log('❌ Auth check error:', error.message);
  }

  console.log('\n🎯 SUMMARY:');
  console.log('The most likely issues are:');
  console.log('1. pgvector extension not enabled (CRITICAL)');
  console.log('2. RLS policies requiring authenticated users');
  console.log('3. OpenAI API issues');
  console.log('\n🔧 IMMEDIATE ACTION REQUIRED:');
  console.log('Run this SQL in your Supabase SQL Editor:');
  console.log('CREATE EXTENSION IF NOT EXISTS vector;');
}

debugMemorySystem().catch(console.error);