#!/usr/bin/env node

/**
 * Simple script to seed the jonathan_braden avatar using the onboarding endpoint
 */

const seedData = {
  profileName: "jonathan_braden",  // Use profileName instead of avatarSlug
  formBasics: {
    full_name: "Jonathan Braden",
    given_name: "Jonathan", 
    home_city: "Vancouver Island",
    home_country: "Canada",
    profession: "Writer",
    birth_year: "1980",
    personality: "Friendly and helpful",
    pets: "Dog named Romeo"
  },
  freeText: "I am Jonathan Braden, a writer living on Vancouver Island in Canada. I was born in 1980 and have lived in various places including Maine, Austin Texas, and France. I have a friendly personality and enjoy natural conversations. I have a dog named Romeo and a partner named Krissy."
};

async function seedJonathan() {
  try {
    console.log('🌱 Seeding Jonathan Braden avatar...');
    
    const response = await fetch('http://localhost:3000/api/onboarding/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(seedData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Success!');
    console.log('Avatar ID:', result.avatar_id);
    console.log('Facts upserted:', result.facts_upserted);
    console.log('Summary ID:', result.summary_id);
    
    if (result.facts_upserted >= 8) {
      console.log('🎉 Avatar seeded successfully! You can now chat with Jonathan.');
    } else {
      console.log('⚠️  Only', result.facts_upserted, 'facts were seeded. Expected at least 8.');
    }

  } catch (error) {
    console.error('❌ Error seeding avatar:', error.message);
    
    // Check if it's a network error
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure the Next.js app is running: npm run dev');
      console.log('2. Check that the app is accessible at http://localhost:3000');
      console.log('3. Verify your environment variables are set correctly');
    }
  }
}

// Run if called directly
if (require.main === module) {
  seedJonathan();
}

module.exports = { seedJonathan };