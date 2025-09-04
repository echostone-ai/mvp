// Debug script to investigate the Olive memory retrieval issue
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOliveMemoryIssue() {
    const DEMO_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
    const query = 'Tell me about Olive';

    console.log('=== DEBUGGING OLIVE MEMORY ISSUE ===');
    console.log('Query:', query);
    console.log('Avatar ID:', DEMO_AVATAR_ID);
    console.log('');

    // 1. Check all memories containing "Olive"
    console.log('1. Searching for memories containing "Olive":');
    const { data: oliveMemories, error: oliveError } = await supabase
        .from('memory_fragments')
        .select('*')
        .eq('avatar_id', DEMO_AVATAR_ID)
        .ilike('fragment_text', '%olive%');

    if (oliveError) {
        console.error('Error searching for Olive memories:', oliveError);
    } else {
        console.log(`Found ${oliveMemories.length} memories containing "Olive":`);
        oliveMemories.forEach((memory, index) => {
            console.log(`\n  Memory ${index + 1}:`);
            console.log(`  ID: ${memory.id}`);
            console.log(`  Type: ${memory.conversation_context?.type || 'unknown'}`);
            console.log(`  Text: ${memory.fragment_text.substring(0, 200)}...`);
        });
    }

    console.log('\n');

    // 2. Check memories containing "multimedia storytelling"
    console.log('2. Searching for memories containing "multimedia storytelling":');
    const { data: multimediaMemories, error: multimediaError } = await supabase
        .from('memory_fragments')
        .select('*')
        .eq('avatar_id', DEMO_AVATAR_ID)
        .ilike('fragment_text', '%multimedia storytelling%');

    if (multimediaError) {
        console.error('Error searching for multimedia memories:', multimediaError);
    } else {
        console.log(`Found ${multimediaMemories.length} memories containing "multimedia storytelling":`);
        multimediaMemories.forEach((memory, index) => {
            console.log(`\n  Memory ${index + 1}:`);
            console.log(`  ID: ${memory.id}`);
            console.log(`  Type: ${memory.conversation_context?.type || 'unknown'}`);
            console.log(`  Text: ${memory.fragment_text.substring(0, 200)}...`);
        });
    }

    console.log('\n');

    // 3. Test the enhanced memory search function
    console.log('3. Testing enhanced memory search for "Tell me about Olive":');
    try {
        const { data: enhancedResults, error: enhancedError } = await supabase.rpc('get_enhanced_memories', {
            target_user_id: null,
            target_avatar_id: DEMO_AVATAR_ID,
            search_query: query,
            match_count: 10,
            similarity_threshold: 0.1
        });

        if (enhancedError) {
            console.error('Enhanced search error:', enhancedError);
        } else {
            console.log(`Enhanced search found ${enhancedResults.length} results:`);
            enhancedResults.forEach((result, index) => {
                console.log(`\n  Result ${index + 1}:`);
                console.log(`  ID: ${result.id}`);
                console.log(`  Similarity: ${result.similarity_score}`);
                console.log(`  Type: ${result.conversation_context?.type || 'unknown'}`);
                console.log(`  Text: ${result.fragment_text.substring(0, 200)}...`);
            });
        }
    } catch (e) {
        console.error('Enhanced search failed:', e);
    }

    console.log('\n');

    // 4. Test keyword search
    console.log('4. Testing keyword search for "olive":');
    const { data: keywordResults, error: keywordError } = await supabase
        .from('memory_fragments')
        .select('*')
        .eq('avatar_id', DEMO_AVATAR_ID)
        .ilike('fragment_text', '%olive%')
        .order('created_at', { ascending: false })
        .limit(10);

    if (keywordError) {
        console.error('Keyword search error:', keywordError);
    } else {
        console.log(`Keyword search found ${keywordResults.length} results:`);
        keywordResults.forEach((result, index) => {
            console.log(`\n  Result ${index + 1}:`);
            console.log(`  ID: ${result.id}`);
            console.log(`  Type: ${result.conversation_context?.type || 'unknown'}`);
            console.log(`  Text: ${result.fragment_text.substring(0, 200)}...`);
        });
    }

    console.log('\n=== DEBUG COMPLETE ===');
}

debugOliveMemoryIssue().catch(console.error);