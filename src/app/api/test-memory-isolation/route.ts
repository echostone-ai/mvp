// Test memory isolation between avatars
import { NextResponse } from 'next/server';
import { supabase } from '@/components/supabaseClient';

export async function POST(req: Request) {
  try {
    const { userId, avatar1Id, avatar2Id, testMessage } = await req.json();
    
    if (!userId || !avatar1Id || !avatar2Id || !testMessage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Step 1: Store a memory for avatar1
    const testMemory = `User told ${avatar1Id}: ${testMessage}`;
    
    const { data: memoryData, error: memoryError } = await supabase
      .from('memory_fragments')
      .insert({
        user_id: userId,
        avatar_id: avatar1Id,
        fragment_text: testMemory,
        embedding: new Array(1536).fill(0.1), // Dummy embedding for test
        conversation_context: {
          timestamp: new Date().toISOString(),
          messageContext: 'Test memory isolation',
          avatarId: avatar1Id
        }
      })
      .select()
      .single();
    
    if (memoryError) {
      return NextResponse.json({ error: 'Failed to store test memory', details: memoryError }, { status: 500 });
    }
    
    // Step 2: Query memories for avatar1 (should find the memory)
    const { data: avatar1Memories, error: avatar1Error } = await supabase
      .from('memory_fragments')
      .select('*')
      .eq('user_id', userId)
      .eq('avatar_id', avatar1Id);
    
    // Step 3: Query memories for avatar2 (should NOT find the memory)
    const { data: avatar2Memories, error: avatar2Error } = await supabase
      .from('memory_fragments')
      .select('*')
      .eq('user_id', userId)
      .eq('avatar_id', avatar2Id);
    
    // Step 4: Query all user memories (should find the memory)
    const { data: allMemories, error: allError } = await supabase
      .from('memory_fragments')
      .select('*')
      .eq('user_id', userId);
    
    return NextResponse.json({
      testMemoryId: memoryData.id,
      results: {
        avatar1Memories: {
          count: avatar1Memories?.length || 0,
          hasTestMemory: avatar1Memories?.some(m => m.id === memoryData.id) || false,
          error: avatar1Error?.message
        },
        avatar2Memories: {
          count: avatar2Memories?.length || 0,
          hasTestMemory: avatar2Memories?.some(m => m.id === memoryData.id) || false,
          error: avatar2Error?.message
        },
        allMemories: {
          count: allMemories?.length || 0,
          hasTestMemory: allMemories?.some(m => m.id === memoryData.id) || false,
          error: allError?.message
        }
      },
      isolation: {
        working: (avatar1Memories?.some(m => m.id === memoryData.id) || false) && 
                !(avatar2Memories?.some(m => m.id === memoryData.id) || false),
        message: (avatar1Memories?.some(m => m.id === memoryData.id) || false) && 
                !(avatar2Memories?.some(m => m.id === memoryData.id) || false) 
                ? "✅ Memory isolation is working correctly"
                : "❌ Memory isolation is not working - memory leaked between avatars"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message 
    }, { status: 500 });
  }
}