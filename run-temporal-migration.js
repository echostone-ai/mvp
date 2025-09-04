const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function runTemporalMigration() {
    try {
        console.log('=== Running Temporal Migration ===');
        
        // Add columns using raw SQL
        const { error: alterError } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE quick_facts 
                ADD COLUMN IF NOT EXISTS fact_type text CHECK (fact_type IN ('current', 'historical', 'critical')) DEFAULT 'current',
                ADD COLUMN IF NOT EXISTS time_context jsonb DEFAULT '{}';
            `
        });
        
        if (alterError) {
            console.error('Error adding columns:', alterError);
            return;
        }
        
        console.log('✅ Added fact_type and time_context columns');
        
        // Update existing facts
        const { error: updateError } = await supabase
            .from('quick_facts')
            .update({ fact_type: 'current' })
            .is('fact_type', null);
        
        if (updateError) {
            console.error('Error updating facts:', updateError);
        } else {
            console.log('✅ Updated existing facts to current type');
        }
        
        // Set critical facts
        const { error: criticalError } = await supabase
            .from('quick_facts')
            .update({ fact_type: 'critical' })
            .in('key', ['given_name', 'full_name', 'birth_date', 'birth_year', 'profession', 'birthplace']);
        
        if (criticalError) {
            console.error('Error setting critical facts:', criticalError);
        } else {
            console.log('✅ Set critical facts');
        }
        
        // Clean up old marriage facts and add proper temporal ones
        const { error: deleteError } = await supabase
            .from('quick_facts')
            .delete()
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .in('key', ['marriage_history', 'relationship_status', 'marriage_tia']);
        
        if (deleteError) {
            console.error('Error deleting old facts:', deleteError);
        } else {
            console.log('✅ Cleaned up old marriage facts');
        }
        
        // Add historical marriage fact
        const { error: marriageError } = await supabase
            .from('quick_facts')
            .insert({
                avatar_id: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
                key: 'marriage_tia',
                value: 'Married to Tia (first girlfriend) for 10 years',
                fact_type: 'historical',
                time_context: { start: '1999', end: '2009', duration: '10 years' },
                priority: 1,
                confidence: 0.95,
                source: 'manual',
                source_reference: 'temporal-fix'
            });
        
        if (marriageError) {
            console.error('Error adding marriage fact:', marriageError);
        } else {
            console.log('✅ Added historical marriage fact');
        }
        
        // Update current relationship
        const { error: partnerError } = await supabase
            .from('quick_facts')
            .update({
                value: 'Krissy',
                fact_type: 'current',
                time_context: { since: '2023' }
            })
            .eq('key', 'partner_name')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c');
        
        if (partnerError) {
            console.error('Error updating partner fact:', partnerError);
        } else {
            console.log('✅ Updated current relationship fact');
        }
        
        console.log('\n=== Migration Complete ===');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

runTemporalMigration();