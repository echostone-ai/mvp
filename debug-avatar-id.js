const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://xiftnqnwyjixwqgxqfez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZnRucW53eWppeHdxZ3hxZmV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY2MjI0NSwiZXhwIjoyMDcwMjM4MjQ1fQ.7NWQofZH1WnEWgSKBnLUEpTRhun10if5VmjILc_lL74'
);

async function debugAvatarId() {
    try {
        console.log('=== Finding Jonathan Avatar ===');
        const { data, error } = await supabase
            .from('avatars')
            .select('*')
            .or('slug.eq.jonathan_braden,slug.eq.jonathan-demo,name.ilike.%jonathan%');
        
        if (error) {
            console.error('Error:', error);
            return;
        }
        
        console.log('Found avatars:');
        data.forEach((avatar, i) => {
            console.log(`${i + 1}. ID: ${avatar.id}, Slug: ${avatar.slug}, Name: ${avatar.name}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugAvatarId();