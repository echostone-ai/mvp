const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function debugJonathanFacts() {
    try {
        console.log('=== Jonathan Facts ===');
        const { data, error } = await supabase
            .from('quick_facts')
            .select('*')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .order('priority', { ascending: false });
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log(`Found ${data.length} facts:`);
        data.forEach((fact, i) => {
            console.log(`${i + 1}. ${fact.key}: ${fact.value} (priority: ${fact.priority})`);
        });
        
        console.log('\n=== RELATIONSHIP-RELATED FACTS ===');
        const relationshipFacts = data.filter(f => 
            f.key.toLowerCase().includes('relationship') ||
            f.key.toLowerCase().includes('partner') ||
            f.key.toLowerCase().includes('married') ||
            f.key.toLowerCase().includes('single') ||
            f.value.toLowerCase().includes('single') ||
            f.value.toLowerCase().includes('married')
        );
        
        if (relationshipFacts.length > 0) {
            relationshipFacts.forEach((fact, i) => {
                console.log(`${i + 1}. ${fact.key}: ${fact.value} (priority: ${fact.priority})`);
            });
        } else {
            console.log('No relationship-related facts found');
        }
        
        console.log('\n=== CHECKING MEMORIES ===');
        const { data: memories, error: memError } = await supabase
            .from('memory_fragments')
            .select('*')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .ilike('fragment_text', '%married%');
            
        if (memError) {
            console.error('Memory Error:', memError);
        } else {
            console.log(`Found ${memories.length} marriage memories:`);
            memories.forEach((mem, i) => {
                console.log(`${i + 1}. ${mem.fragment_text}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugJonathanFacts();