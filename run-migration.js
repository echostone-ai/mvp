// Script to run the database migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('Running database migration...\n');

  try {
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync('supabase/migrations/001_create_memory_fragments.sql', 'utf8');
    
    console.log('1. Executing migration SQL...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`   Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`   ✗ Error in statement ${i + 1}:`, error.message);
        // Continue with other statements
      } else {
        console.log(`   ✓ Statement ${i + 1} executed successfully`);
      }
    }

    // Read and execute the function SQL
    console.log('\n2. Creating vector similarity function...');
    const functionSQL = fs.readFileSync('supabase/functions/match_memory_fragments.sql', 'utf8');
    
    const { error: funcError } = await supabase.rpc('exec_sql', { sql: functionSQL });
    
    if (funcError) {
      console.error('   ✗ Error creating function:', funcError.message);
    } else {
      console.log('   ✓ Vector similarity function created successfully');
    }

    console.log('\n✅ Migration completed!');
    console.log('You can now run: node test-vector-operations.js');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\nNote: You may need to run these SQL statements manually in your Supabase dashboard:');
    console.log('1. supabase/migrations/001_create_memory_fragments.sql');
    console.log('2. supabase/functions/match_memory_fragments.sql');
  }
}

runMigration();