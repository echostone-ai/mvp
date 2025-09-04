#!/usr/bin/env node

const BASE_URL = 'http://localhost:3000';

async function testSimpleChat() {
  console.log('Testing simple chat request...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarSlug: 'jonathan-demo',
        message: 'How long were you in Austin?'
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.log('No response body reader');
      return;
    }

    console.log('\nStreaming response:');
    let chunks = 0;
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('\nStream ended');
        break;
      }
      
      chunks++;
      const text = decoder.decode(value);
      console.log(`Chunk ${chunks}:`, JSON.stringify(text));
      
      if (chunks > 20) {
        console.log('Too many chunks, stopping...');
        break;
      }
    }
    
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

testSimpleChat();