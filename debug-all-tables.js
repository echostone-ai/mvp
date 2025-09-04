const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function debugAllTables() {
    try {
        // Common table names to try
        const tables = [
            'avatar_shares', 'memory_fragments', 'conversation_turns', 
            'user_profiles', 'profiles', 'users', 'quick_facts',
            'avatar_quick_facts', 'persona_facts', 'facts'
        ];
        
        for (const table of tables) {
            console.log(`\n=== Trying table: ${table} ===`);
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .limit(3);
                
            if (error) {
                console.log(`❌ ${error.message}`);
            } else {
                console.log(`✅ Success! Found ${data.length} rows`);
                if (data.length > 0) {
                    console.log('Columns:', Object.keys(data[0]));
                    console.log('Sample:', data[0]);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugAllTables();