const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function checkTemporalMigration() {
    try {
        console.log('=== Checking Temporal Migration ===');
        
        // Check if columns exist
        const { data: facts, error } = await supabase
            .from('quick_facts')
            .select('*')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .order('priority', { ascending: true });
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('Current facts structure:');
        facts.forEach(fact => {
            console.log(`- ${fact.key}: ${fact.value}`);
            console.log(`  Type: ${fact.fact_type || 'NULL'}`);
            console.log(`  Time Context: ${JSON.stringify(fact.time_context || {})}`);
            console.log(`  Priority: ${fact.priority}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTemporalMigration();