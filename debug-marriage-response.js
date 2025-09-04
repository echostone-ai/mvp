const fetch = require('node-fetch');

async function debugMarriageResponse() {
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
        
        console.log('=== RESPONSE TEXT ===');
        console.log(data.text);
        
        console.log('\n=== MEMORIES FOUND ===');
        console.log('Count:', data.metadata.memories_count);
        
        if (data.debug && data.debug.memoriesPreview) {
            console.log('\nMemory previews:');
            data.debug.memoriesPreview.forEach((mem, i) => {
                console.log(`${i + 1}. ${mem}`);
            });
        }
        
        console.log('\n=== FULL PROMPT PREVIEW ===');
        if (data.debug && data.debug.promptPreview) {
            console.log(data.debug.promptPreview);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugMarriageResponse();