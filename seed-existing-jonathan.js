#!/usr/bin/env node

/**
 * Seed the existing Jonathan avatar with facts using the onboarding endpoint
 */

async function seedExistingJonathan() {
  try {
    console.log('🌱 Seeding existing Jonathan avatar with facts...');
    
    const seedData = {
      profileName: "jonathan_braden",  // This matches the name in avatar_profiles
      formBasics: {
        full_name: "Jonathan Braden",
        given_name: "Jonathan", 
        home_city: "Vancouver Island",
        home_country: "Canada",
        profession: "Writer",
        birth_year: "1980",
        personality: "Witty, quick, warm personality with playful sarcasm",
        pets: "Dog named Romeo",
        partner_name: "Krissy",
        places_lived: "Vancouver Island, Maine, Austin Texas, France"
      },
      freeText: "I am Jonathan Braden, a witty writer living on Vancouver Island in Canada. I was born in 1980 and have lived in various places including Maine, Austin Texas, and Verteillac France. I have a warm personality with playful sarcasm when it fits. I have a dog named Romeo and a partner named Krissy. I enjoy natural conversations and have many stories from my travels and experiences."
    };

    const response = await fetch('http://localhost:3000/api/onboarding/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(seedData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Seeding failed:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Seeding Success!');
    console.log('Avatar ID:', result.avatar_id);
    console.log('Facts upserted:', result.facts_upserted);
    console.log('Summary ID:', result.summary_id);
    
    if (result.facts_upserted >= 8) {
      console.log('🎉 Avatar seeded successfully! Jonathan should now know who he is.');
      console.log('💬 Try asking: "Who are you?" or "Tell me about yourself"');
    } else {
      console.log('⚠️  Only', result.facts_upserted, 'facts were seeded. Expected at least 8.');
    }

  } catch (error) {
    console.error('❌ Error seeding avatar:', error.message);
    
    if (error.message.includes('fetch failed')) {
      console.log('💡 Make sure the Next.js app is running at http://localhost:3000');
    }
  }
}

// Run if called directly
if (require.main === module) {
  seedExistingJonathan();
}

module.exports = { seedExistingJonathan };