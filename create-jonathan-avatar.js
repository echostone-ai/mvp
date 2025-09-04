#!/usr/bin/env node

/**
 * Script to create the jonathan_braden avatar profile first, then seed it with data
 */

async function createAvatarProfile() {
  try {
    console.log('🔧 Creating Jonathan Braden avatar profile...');
    
    // First, create the avatar profile
    const createResponse = await fetch('http://localhost:3000/api/avatars/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: "jonathan_braden",
        speaking_style: "Natural conversational style",
        core_facts: {
          full_name: "Jonathan Braden",
          personality: "Friendly and helpful with natural conversational style",
          profession: "Writer",
          home_location: "Vancouver Island, Canada"
        }
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('⚠️  Avatar creation response:', errorText);
      // Continue anyway - avatar might already exist
    } else {
      const createResult = await createResponse.json();
      console.log('✅ Avatar profile created:', createResult);
    }

  } catch (error) {
    console.log('⚠️  Avatar creation failed (might already exist):', error.message);
  }
}

async function seedAvatarData() {
  try {
    console.log('🌱 Seeding Jonathan Braden avatar data...');
    
    const seedData = {
      profileName: "jonathan_braden",
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
    console.log('✅ Seeding Success!');
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
  }
}

async function main() {
  await createAvatarProfile();
  await seedAvatarData();
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createAvatarProfile, seedAvatarData };