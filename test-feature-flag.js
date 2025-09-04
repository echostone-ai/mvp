// Test feature flag in browser console
console.log('🔍 TESTING FEATURE FLAG');

// Check environment variables
console.log('Environment variables:');
console.log('- EXPRESSION_OVERLAYS_ENABLED:', process.env.EXPRESSION_OVERLAYS_ENABLED);
console.log('- NEXT_PUBLIC_EXPRESSION_OVERLAYS_ENABLED:', process.env.NEXT_PUBLIC_EXPRESSION_OVERLAYS_ENABLED);

// Try to import and test the feature flag function
import('/lib/featureFlags.js').then(module => {
  console.log('Feature flag module loaded');
  const isEnabled = module.isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED');
  console.log('EXPRESSION_OVERLAYS_ENABLED:', isEnabled);
}).catch(error => {
  console.error('Failed to load feature flags:', error);
  
  // Manual check
  const manualCheck = process.env.NEXT_PUBLIC_EXPRESSION_OVERLAYS_ENABLED === 'true';
  console.log('Manual feature flag check:', manualCheck);
});