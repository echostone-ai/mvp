// Simple script to clear HeyGen sessions
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function clearAllSessions() {
  try {
    console.log('🔍 Checking for active HeyGen sessions...');
    
    // List active sessions
    const listResponse = await fetch('https://api.heygen.com/v1/streaming.list', {
      method: 'GET',
      headers: {
        'X-Api-Key': HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!listResponse.ok) {
      console.error('❌ Failed to list sessions:', await listResponse.text());
      return;
    }

    const listData = await listResponse.json();
    console.log('📋 Sessions found:', listData);

    if (listData.data && listData.data.sessions && listData.data.sessions.length > 0) {
      console.log(`🧹 Closing ${listData.data.sessions.length} active sessions...`);
      
      for (const session of listData.data.sessions) {
        try {
          const closeResponse = await fetch('https://api.heygen.com/v1/streaming.stop', {
            method: 'POST',
            headers: {
              'X-Api-Key': HEYGEN_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              session_id: session.session_id,
            }),
          });

          if (closeResponse.ok) {
            console.log(`✅ Closed session: ${session.session_id}`);
          } else {
            console.log(`❌ Failed to close session: ${session.session_id}`);
          }
        } catch (error) {
          console.log(`❌ Error closing session ${session.session_id}:`, error.message);
        }
      }
      
      console.log('🎉 All sessions cleared! You can now try connecting to the avatar.');
    } else {
      console.log('✅ No active sessions found. You should be able to connect to the avatar.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearAllSessions();