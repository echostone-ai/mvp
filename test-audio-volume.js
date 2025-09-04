// Test audio volume - paste this in browser console
console.log('🔊 TESTING AUDIO VOLUME');

// Test your laugh directly at full volume
const testLaugh = new Audio('https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Laugh_copy_1755508777740.mp3');
testLaugh.volume = 1.0; // Full volume
testLaugh.play().then(() => {
  console.log('✅ Direct laugh test at full volume');
}).catch(error => {
  console.error('❌ Direct laugh test failed:', error);
});

// Test your sigh
setTimeout(() => {
  const testSigh = new Audio('https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Sigh_1755522153865.mp3');
  testSigh.volume = 1.0;
  testSigh.play().then(() => {
    console.log('✅ Direct sigh test at full volume');
  }).catch(error => {
    console.error('❌ Direct sigh test failed:', error);
  });
}, 2000);

// Test your jeez
setTimeout(() => {
  const testJeez = new Audio('https://xiftnqnwyjixwqgxqfez.supabase.co/storage/v1/object/public/expressions/avatars/jonathan-demo/jonathan_Jeez_1755508365217.mp3');
  testJeez.volume = 1.0;
  testJeez.play().then(() => {
    console.log('✅ Direct jeez test at full volume');
  }).catch(error => {
    console.error('❌ Direct jeez test failed:', error);
  });
}, 4000);

console.log('🔊 Audio tests started - you should hear 3 sounds over 6 seconds');