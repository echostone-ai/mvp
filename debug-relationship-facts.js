const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function debugRelationshipFacts() {
    try {
        // Get all facts for Jonathan
        const { data: facts, error } = await supabase
            .from('avatar_facts')
            .select('*')
            .eq('avatar_id', 'jonathan_braden')
            .order('priority', { ascending: false });
            
        if (error) {
            console.error('Error fetching facts:', error);
            return;
        }
        
        console.log('=== ALL JONATHAN FACTS ===');
        facts.forEach((fact, i) => {
            console.log(`${i + 1}. ${fact.fact_key}: ${fact.fact_value} (priority: ${fact.priority})`);
        });
        
        console.log('\n=== RELATIONSHIP-RELATED FACTS ===');
        const relationshipFacts = facts.filter(f => 
            f.fact_key.toLowerCase().includes('relationship') ||
            f.fact_key.toLowerCase().includes('partner') ||
            f.fact_key.toLowerCase().includes('married') ||
            f.fact_key.toLowerCase().includes('single') ||
            f.fact_value.toLowerCase().includes('single') ||
            f.fact_value.toLowerCase().includes('married')
        );
        
        relationshipFacts.forEach((fact, i) => {
            console.log(`${i + 1}. ${fact.fact_key}: ${fact.fact_value} (priority: ${fact.priority})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugRelationshipFacts();