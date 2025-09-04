const fetch = require('node-fetch');

async function testMarriageWithDebug() {
    try {
        console.log('=== Testing Marriage Question with Full Debug ===');
        
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
        
        console.log('\n=== FACTS PREVIEW ===');
        if (data.debug && data.debug.factsPreview) {
            data.debug.factsPreview.forEach((fact, i) => {
                console.log(`${i + 1}. ${fact}`);
            });
        }
        
        console.log('\n=== MEMORIES PREVIEW ===');
        if (data.debug && data.debug.memoriesPreview) {
            data.debug.memoriesPreview.forEach((mem, i) => {
                console.log(`${i + 1}. ${mem}`);
            });
        }
        
        console.log('\n=== METADATA ===');
        console.log('Facts count:', data.metadata.facts_count);
        console.log('Memories count:', data.metadata.memories_count);
        
        // Check if marriage_history is in the facts
        const factsText = JSON.stringify(data.debug.factsPreview || []);
        if (factsText.includes('marriage_history') || factsText.includes('married')) {
            console.log('\n✅ Marriage facts found in preview');
        } else {
            console.log('\n❌ Marriage facts NOT found in preview');
        }
        
        // Check if memories mention marriage
        const memoriesText = JSON.stringify(data.debug.memoriesPreview || []);
        if (memoriesText.includes('married') || memoriesText.includes('Tia')) {
            console.log('✅ Marriage memories found');
        } else {
            console.log('❌ Marriage memories NOT found');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testMarriageWithDebug();