const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function debugResolveAvatar() {
    try {
        console.log('=== Checking avatar_profiles ===');
        const { data: profiles, error: profileError } = await supabase
            .from('avatar_profiles')
            .select('*')
            .or('name.eq.jonathan_braden,name.eq.jonathan-demo,name.ilike.%jonathan%');
        
        if (profileError) {
            console.log('Profile error:', profileError.message);
        } else {
            console.log(`Found ${profiles.length} profiles:`);
            profiles.forEach(p => console.log(`- ID: ${p.id}, Name: ${p.name}`));
        }
        
        console.log('\n=== Checking avatars table ===');
        const { data: avatars, error: avatarError } = await supabase
            .from('avatars')
            .select('*')
            .or('slug.eq.jonathan_braden,slug.eq.jonathan-demo,name.ilike.%jonathan%');
        
        if (avatarError) {
            console.log('Avatar error:', avatarError.message);
        } else {
            console.log(`Found ${avatars.length} avatars:`);
            avatars.forEach(a => console.log(`- ID: ${a.id}, Slug: ${a.slug}, Name: ${a.name}`));
        }
        
        console.log('\n=== Checking what avatar_id is being used ===');
        // Check what facts exist for jonathan_braden as string
        const { data: stringCheck, error: stringError } = await supabase
            .from('quick_facts')
            .select('avatar_id')
            .eq('avatar_id', 'jonathan_braden')
            .limit(1);
            
        if (stringError) {
            console.log('String check error:', stringError.message);
        } else {
            console.log(`Facts with string ID: ${stringCheck.length}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugResolveAvatar();