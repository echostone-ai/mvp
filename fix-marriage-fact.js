const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function fixMarriageFact() {
    try {
        console.log('=== Adding Marriage History Fact ===');
        
        // Add a fact about his marriage history
        const { data, error } = await supabase
            .from('quick_facts')
            .insert({
                avatar_id: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
                key: 'marriage_history',
                value: 'Previously married to Tia for 10 years (first girlfriend)',
                confidence: 0.95,
                priority: 3,
                source: 'manual',
                source_reference: 'marriage-fix'
            });
        
        if (error) {
            console.error('Error adding fact:', error);
            return;
        }
        
        console.log('✅ Successfully added marriage history fact');
        
        // Also update relationship status to be clearer
        const { data: updateData, error: updateError } = await supabase
            .from('quick_facts')
            .insert({
                avatar_id: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
                key: 'relationship_status',
                value: 'Currently dating Krissy (previously married to Tia)',
                confidence: 0.95,
                priority: 3,
                source: 'manual',
                source_reference: 'relationship-clarification'
            });
        
        if (updateError) {
            console.error('Error adding relationship status:', updateError);
        } else {
            console.log('✅ Successfully added relationship status fact');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixMarriageFact();