// Quick test to check if Romeo facts exist
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRomeoFacts() {
  console.log('🔍 Checking for Romeo/pet facts...\n');
  
  try {
    // Get jonathan-demo avatar ID
    const { data: avatar } = await supabase
      .from('avatar_profiles')
      .select('id')
      .eq('name', 'jonathan-demo')
      .single();
    
    if (!avatar) {
      console.log('❌ jonathan-demo avatar not found');
      return;
    }
    
    console.log('✅ Found avatar ID:', avatar.id);
    
    // Check for pet facts
    const { data: petFacts } = await supabase
      .from('quick_facts')
      .select('*')
      .eq('avatar_id', avatar.id)
      .or('key.like.%pet%,key.like.%romeo%,key.like.%dog%');
    
    console.log('\n🐕 Pet-related facts:');
    if (petFacts && petFacts.length > 0) {
      petFacts.forEach(fact => {
        console.log(`  - ${fact.key}: ${fact.value} (confidence: ${fact.confidence})`);
      });
    } else {
      console.log('  ❌ No pet facts found!');
    }
    
    // Check for Romeo in memories
    const { data: romeoMemories } = await supabase
      .from('memory_fragments')
      .select('fragment_text')
      .eq('avatar_id', avatar.id)
      .ilike('fragment_text', '%romeo%')
      .limit(3);
    
    console.log('\n💭 Romeo memories:');
    if (romeoMemories && romeoMemories.length > 0) {
      romeoMemories.forEach(memory => {
        console.log(`  - ${memory.fragment_text.substring(0, 100)}...`);
      });
    } else {
      console.log('  ❌ No Romeo memories found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRomeoFacts();