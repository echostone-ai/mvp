const fetch = require('node-fetch');

async function debugFullPrompt() {
    try {
        const response = await fetch('http://localhost:3000/api/demo-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'have you ever been married?',
                avatar: 'jonathan_braden',
                debug: true
            })
        });
        
        const data = await response.json();
        
        console.log('=== FULL PROMPT ===');
        if (data.debug && data.debug.promptPreview) {
            // The prompt preview is truncated, let's see what we can get
            console.log(data.debug.promptPreview);
        }
        
        console.log('\n=== RESPONSE ===');
        console.log(data.text);
        
        console.log('\n=== METADATA ===');
        console.log('Facts count:', data.metadata.facts_count);
        console.log('Memories count:', data.metadata.memories_count);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugFullPrompt();