const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function testTemporalFacts() {
    try {
        console.log('=== Testing Temporal Facts Organization ===');
        
        // Fetch all facts for Jonathan
        const { data: facts, error } = await supabase
            .from('quick_facts')
            .select('*')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .order('priority', { ascending: true });
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('\n=== ALL FACTS ===');
        facts.forEach(fact => {
            console.log(`${fact.key}: ${fact.value} (priority: ${fact.priority})`);
        });
        
        // Simulate the temporal organization logic
        const criticalKeys = ['given_name', 'full_name', 'birth_date', 'birth_year', 'profession', 'birthplace'];
        
        const criticalFacts = facts.filter(f => criticalKeys.includes(f.key));
        const historicalFacts = facts.filter(f => isHistoricalFact(f));
        const currentFacts = facts.filter(f => 
            !isHistoricalFact(f) && 
            !criticalKeys.includes(f.key) &&
            !f.key.startsWith('historical_')
        );
        
        console.log('\n=== CRITICAL FACTS ===');
        criticalFacts.forEach(f => console.log(`- ${f.key}: ${f.value}`));
        
        console.log('\n=== CURRENT FACTS ===');
        currentFacts.forEach(f => console.log(`- ${f.key}: ${f.value}`));
        
        console.log('\n=== HISTORICAL FACTS ===');
        historicalFacts.forEach(f => console.log(`- ${f.key}: ${f.value}`));
        
        // Test with a marriage question
        console.log('\n=== TESTING MARRIAGE QUESTION ===');
        const marriageRelatedFacts = facts.filter(f => 
            f.key.includes('marriage') || 
            f.key.includes('partner') ||
            f.key.includes('relationship') ||
            f.value.toLowerCase().includes('tia') ||
            f.value.toLowerCase().includes('married')
        );
        
        console.log('Marriage-related facts found:');
        marriageRelatedFacts.forEach(f => {
            const isHistorical = isHistoricalFact(f);
            console.log(`- ${f.key}: ${f.value} [${isHistorical ? 'HISTORICAL' : 'CURRENT'}]`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

function isHistoricalFact(fact) {
    const historicalKeys = [
        'marriage_tia', 'marriage_history', 'previous_job', 'education',
        'places_lived', 'moved_to', 'childhood', 'school', 'historical_marriage_tia',
        'relationship_timeline'
    ];
    
    const historicalPatterns = [
        'previously', 'former', 'ex-', 'was', 'used to', 'lived in',
        'married to', 'divorced', 'graduated', 'studied', 'was married',
        'from 1999', 'until 2009', '1999-2009', 'for 10 years'
    ];
    
    return historicalKeys.includes(fact.key) || 
           fact.key.startsWith('historical_') ||
           historicalPatterns.some(pattern => 
               fact.value.toLowerCase().includes(pattern)
           );
}

testTemporalFacts();