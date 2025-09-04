const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function fixMarriagePriorityHigher() {
    try {
        console.log('=== Setting Marriage Facts to Priority 1 (Highest) ===');
        
        // Update marriage_history to priority 1
        const { error: error1 } = await supabase
            .from('quick_facts')
            .update({ priority: 1 })
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .eq('key', 'marriage_history');
        
        if (error1) {
            console.error('Error updating marriage_history:', error1);
        } else {
            console.log('✅ Updated marriage_history to priority 1');
        }
        
        // Update relationship_status to priority 1
        const { error: error2 } = await supabase
            .from('quick_facts')
            .update({ priority: 1 })
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .eq('key', 'relationship_status');
        
        if (error2) {
            console.error('Error updating relationship_status:', error2);
        } else {
            console.log('✅ Updated relationship_status to priority 1');
        }
        
        // Also, let's remove the conflicting partner_name fact that says Krissy
        console.log('\n=== Updating partner_name fact ===');
        const { error: error3 } = await supabase
            .from('quick_facts')
            .update({ 
                value: 'Currently dating Krissy (previously married to Tia)',
                priority: 1
            })
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .eq('key', 'partner_name');
        
        if (error3) {
            console.error('Error updating partner_name:', error3);
        } else {
            console.log('✅ Updated partner_name to clarify relationship history');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixMarriagePriorityHigher();