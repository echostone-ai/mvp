const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function debugRpcDirect() {
    try {
        console.log('=== Testing Direct Query ===');
        const { data: directFacts, error: directError } = await supabase
            .from('quick_facts')
            .select('*')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .lte('priority', 4)
            .order('priority', { ascending: true })
            .limit(30);
        
        if (directError) {
            console.error('Direct query error:', directError);
        } else {
            console.log(`Direct query found ${directFacts.length} facts:`);
            directFacts.forEach((fact, i) => {
                console.log(`${i + 1}. ${fact.key}: ${fact.value} (priority: ${fact.priority})`);
            });
            
            const marriageFacts = directFacts.filter(f => 
                f.key.includes('marriage') || f.key.includes('relationship')
            );
            console.log(`\nMarriage facts: ${marriageFacts.length}`);
            marriageFacts.forEach(f => console.log(`- ${f.key}: ${f.value}`));
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugRpcDirect();