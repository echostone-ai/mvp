const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function applyTemporalMigration() {
    try {
        console.log('=== Applying Temporal Fact Model Migration ===');
        
        // Step 1: Add the marriage historical fact
        console.log('1. Adding historical marriage fact...');
        const { error: insertError } = await supabase
            .from('quick_facts')
            .upsert({
                avatar_id: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
                key: 'marriage_tia',
                value: 'Married to Tia (first girlfriend) for 10 years',
                fact_type: 'historical',
                time_context: { start: '1999', end: '2009', duration: '10 years' },
                priority: 1,
                confidence: 0.95,
                source: 'manual',
                source_reference: 'temporal-fix'
            }, { onConflict: 'avatar_id,key' });
        
        if (insertError) {
            console.error('Error adding marriage fact:', insertError);
        } else {
            console.log('✅ Added historical marriage fact');
        }
        
        // Step 2: Update current relationship
        console.log('2. Updating current relationship...');
        const { error: updateError } = await supabase
            .from('quick_facts')
            .update({
                value: 'Krissy',
                fact_type: 'current',
                time_context: { since: '2023' }
            })
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .eq('key', 'partner_name');
        
        if (updateError) {
            console.error('Error updating partner_name:', updateError);
        } else {
            console.log('✅ Updated current relationship');
        }
        
        // Step 3: Set critical facts
        console.log('3. Setting critical facts...');
        const criticalKeys = ['given_name', 'full_name', 'birth_date', 'birth_year', 'profession', 'birthplace'];
        
        for (const key of criticalKeys) {
            const { error } = await supabase
                .from('quick_facts')
                .update({ fact_type: 'critical' })
                .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
                .eq('key', key);
            
            if (error) {
                console.error(`Error updating ${key}:`, error);
            }
        }
        console.log('✅ Set critical facts');
        
        // Step 4: Remove conflicting facts
        console.log('4. Cleaning up conflicting facts...');
        const { error: deleteError } = await supabase
            .from('quick_facts')
            .delete()
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .in('key', ['marriage_history', 'relationship_status']);
        
        if (deleteError) {
            console.error('Error deleting conflicting facts:', deleteError);
        } else {
            console.log('✅ Cleaned up conflicting facts');
        }
        
        console.log('\n=== Migration Complete ===');
        
    } catch (error) {
        console.error('Migration error:', error);
    }
}

applyTemporalMigration();