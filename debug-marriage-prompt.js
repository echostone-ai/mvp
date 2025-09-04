const { createClient } = require('@supabase/supabase-js');
const { EnhancedPromptBuilder } = require('./src/lib/services/enhancedPromptBuilder.ts');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMarriagePrompt() {
    try {
        const builder = new EnhancedPromptBuilder(supabase);
        
        const result = await builder.buildPrompt({
            avatarId: 'jonathan_braden',
            query: 'have you ever been married?',
            conversationHistory: [],
            demoMode: true,
            trackExpressions: true,
            fastMode: false
        });
        
        console.log('=== FULL PROMPT ===');
        console.log(result.prompt);
        console.log('\n=== MEMORIES SECTION ===');
        const memoriesMatch = result.prompt.match(/MEMORIES \(\d+ total\):(.*?)(?=\n\n[A-Z]|$)/s);
        if (memoriesMatch) {
            console.log(memoriesMatch[0]);
        }
        
        console.log('\n=== FACTS SECTION ===');
        const factsMatch = result.prompt.match(/FACTS \(\d+ total\):(.*?)(?=\n\nMEMORIES|$)/s);
        if (factsMatch) {
            console.log(factsMatch[0]);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugMarriagePrompt();