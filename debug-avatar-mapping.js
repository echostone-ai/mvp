const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAvatarMapping() {
    try {
        console.log('=== Checking Facts with String ID ===');
        const { data: stringFacts, error: stringError } = await supabase
            .from('quick_facts')
            .select('*')
            .eq('avatar_id', 'jonathan_braden')
            .limit(5);
        
        if (stringError) {
            console.log('String ID error:', stringError.message);
        } else {
            console.log(`Found ${stringFacts.length} facts with string ID`);
        }
        
        console.log('\n=== Checking Facts with UUID ===');
        const { data: uuidFacts, error: uuidError } = await supabase
            .from('quick_facts')
            .select('*')
            .eq('avatar_id', '0585f43b-4b49-4e16-b2a7-91c8e1e3850c')
            .limit(5);
        
        if (uuidError) {
            console.log('UUID error:', uuidError.message);
        } else {
            console.log(`Found ${uuidFacts.length} facts with UUID`);
            if (uuidFacts.length > 0) {
                console.log('Sample fact:', uuidFacts[0]);
            }
        }
        
        console.log('\n=== Checking All Avatar IDs in Facts ===');
        const { data: allFacts, error: allError } = await supabase
            .from('quick_facts')
            .select('avatar_id')
            .limit(10);
        
        if (allError) {
            console.log('All facts error:', allError.message);
        } else {
            const uniqueIds = [...new Set(allFacts.map(f => f.avatar_id))];
            console.log('Unique avatar IDs in facts:', uniqueIds);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugAvatarMapping();