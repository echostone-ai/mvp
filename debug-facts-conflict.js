const fetch = require('node-fetch');

async function debugFactsConflict() {
    try {
        const response = await fetch('http://localhost:3000/api/demo-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'what is your relationship status?',
                avatar: 'jonathan_braden',
                debug: true
            })
        });
        
        const data = await response.json();
        
        console.log('=== FACTS PREVIEW ===');
        if (data.debug && data.debug.factsPreview) {
            data.debug.factsPreview.forEach((fact, i) => {
                console.log(`${i + 1}. ${fact}`);
            });
        }
        
        console.log('\n=== RESPONSE ===');
        console.log(data.text);
        
        console.log('\n=== MEMORIES PREVIEW ===');
        if (data.debug && data.debug.memoriesPreview) {
            data.debug.memoriesPreview.forEach((mem, i) => {
                console.log(`${i + 1}. ${mem}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugFactsConflict();