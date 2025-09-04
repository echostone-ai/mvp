const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function addTemporalColumns() {
    try {
        console.log('=== Adding Temporal Columns Manually ===');
        
        // First, let's check the current schema
        const { data: sample, error: sampleError } = await supabase
            .from('quick_facts')
            .select('*')
            .limit(1);
        
        if (sampleError) {
            console.error('Error getting sample:', sampleError);
            return;
        }
        
        console.log('Current columns:', Object.keys(sample[0] || {}));
        
        // Since we can't alter the table directly, let's work with what we have
        // and implement the temporal logic in the application layer
        
        // Clean up and reorganize facts for Jonathan
        console.log('\n=== Reorganizing Jonathan\'s Facts ===');
        
        // Delete conflicting facts
        const { error: deleteError } = await supabase
            .from('quick_facts')
            .delete()
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .in('key', ['marriage_history', 'relationship_status', 'marriage_tia', 'marriage_status']);
        
        if (deleteError) {
            console.error('Error deleting facts:', deleteError);
        } else {
            console.log('✅ Cleaned up conflicting facts');
        }
        
        // Add historical marriage fact with special naming convention
        const { error: historicalError } = await supabase
            .from('quick_facts')
            .insert({
                avatar_id: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
                key: 'historical_marriage_tia',
                value: 'Was married to Tia (first girlfriend) from 1999 to 2009 (10 years)',
                priority: 1,
                confidence: 0.95,
                source: 'manual',
                source_reference: 'temporal-architecture-fix'
            });
        
        if (historicalError) {
            console.error('Error adding historical marriage:', historicalError);
        } else {
            console.log('✅ Added historical marriage fact');
        }
        
        // Update current relationship to be clear
        const { error: currentError } = await supabase
            .from('quick_facts')
            .update({
                value: 'Currently dating Krissy',
                priority: 1
            })
            .eq('key', 'partner_name')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c');
        
        if (currentError) {
            console.error('Error updating current relationship:', currentError);
        } else {
            console.log('✅ Updated current relationship');
        }
        
        // Add a comprehensive relationship timeline fact
        const { error: timelineError } = await supabase
            .from('quick_facts')
            .insert({
                avatar_id: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
                key: 'relationship_timeline',
                value: 'Relationship history: Married Tia 1999-2009 (first girlfriend, 10 years). Currently dating Krissy since 2023.',
                priority: 1,
                confidence: 0.95,
                source: 'manual',
                source_reference: 'temporal-architecture-fix'
            });
        
        if (timelineError) {
            console.error('Error adding timeline:', timelineError);
        } else {
            console.log('✅ Added relationship timeline');
        }
        
        console.log('\n=== Temporal Facts Setup Complete ===');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

addTemporalColumns();