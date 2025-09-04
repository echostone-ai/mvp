const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function debugFactAvatarIds() {
    try {
        console.log('=== Checking Marriage Facts ===');
        const { data: marriageFacts, error } = await supabase
            .from('quick_facts')
            .select('*')
            .in('key', ['marriage_history', 'relationship_status']);
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log(`Found ${marriageFacts.length} marriage facts:`);
        marriageFacts.forEach(fact => {
            console.log(`- ${fact.key}: ${fact.value}`);
            console.log(`  Avatar ID: ${fact.avatar_id}`);
            console.log(`  Priority: ${fact.priority}`);
        });
        
        console.log('\n=== Checking Other Facts for Comparison ===');
        const { data: otherFacts, error: otherError } = await supabase
            .from('quick_facts')
            .select('*')
            .in('key', ['given_name', 'profession', 'pets'])
            .limit(3);
        
        if (otherError) {
            console.error('Other facts error:', otherError);
        } else {
            console.log(`Found ${otherFacts.length} other facts:`);
            otherFacts.forEach(fact => {
                console.log(`- ${fact.key}: ${fact.value}`);
                console.log(`  Avatar ID: ${fact.avatar_id}`);
                console.log(`  Priority: ${fact.priority}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugFactAvatarIds();