// setup-memory-database.js
// Script to automatically set up the memory database

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables in .env.local');
  console.log('Please ensure you have:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY (service role key, not anon key)');
  console.log('\nYou can find these in your Supabase dashboard under Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMemoryDatabase() {
  console.log('🚀 Setting up memory database...\n');

  try {
    // Read migration files
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_create_memory_fragments.sql');
    const functionPath = path.join(__dirname, 'supabase', 'functions', 'match_memory_fragments.sql');

    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    if (!fs.existsSync(functionPath)) {
      console.error('❌ Function file not found:', functionPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    const functionSQL = fs.readFileSync(functionPath, 'utf8');

    console.log('1. Running database migration...');
    const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (migrationError) {
      console.log('❌ Migration failed:', migrationError.message);
      console.log('\n📋 Please run the migration manually:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the contents of supabase/migrations/001_create_memory_fragments.sql');
      console.log('4. Execute the SQL');
      return false;
    } else {
      console.log('✅ Migration completed successfully');
    }

    console.log('2. Creating vector search function...');
    const { error: functionError } = await supabase.rpc('exec_sql', { sql: functionSQL });
    
    if (functionError) {
      console.log('❌ Function creation failed:', functionError.message);
      console.log('\n📋 Please create the function manually:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the contents of supabase/functions/match_memory_fragments.sql');
      console.log('4. Execute the SQL');
      return false;
    } else {
      console.log('✅ Vector search function created successfully');
    }

    console.log('\n🎉 Memory database setup completed successfully!');
    console.log('✅ memory_fragments table created');
    console.log('✅ Vector search function created');
    console.log('✅ Indexes and security policies applied');
    
    return true;

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n📋 Manual setup required:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL from supabase/migrations/001_create_memory_fragments.sql');
    console.log('4. Run the SQL from supabase/functions/match_memory_fragments.sql');
    return false;
  }
}

// Run the setup
setupMemoryDatabase().then(success => {
  if (success) {
    console.log('\n🔍 Running verification check...');
    // Run the check script
    require('./check-memory-database.js');
  } else {
    process.exit(1);
  }
});