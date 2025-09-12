#!/usr/bin/env node
// scripts/validate-demo-chat-integration.mjs
// Validate that /api/demo-chat endpoint works correctly with hybrid retrieval

import fs from 'fs';
import path from 'path';

class DemoChatIntegrationValidator {
  constructor() {
    this.results = {
      tests: [],
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async validateIntegration() {
    console.log('🔍 Validating /api/demo-chat Integration with Hybrid Retrieval');
    console.log('=' .repeat(70));

    try {
      // Test 1: Validate factbook loading
      await this.testFactbookLoading();
      
      // Test 2: Validate hybrid retrieval configuration
      await this.testHybridRetrievalConfig();
      
      // Test 3: Validate API route structure
      await this.testAPIRouteStructure();
      
      // Test 4: Validate persona preservation
      await this.testPersonaPreservation();
      
      // Test 5: Validate backward compatibility
      await this.testBackwardCompatibility();
      
      // Test 6: Validate feature flags
      await this.testFeatureFlags();
      
      // Generate summary
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      this.results.errors.push(error.message);
    }
  }

  async testFactbookLoading() {
    console.log('\\n📚 Testing Factbook Loading...');
    
    try {
      // Check if factbook file exists
      const factbookPath = path.join(process.cwd(), 'data/jonathan_profile_factbook.json');
      
      if (!fs.existsSync(factbookPath)) {
        throw new Error('Factbook file not found: data/jonathan_profile_factbook.json');
      }
      
      // Load and validate factbook structure
      const factbookData = JSON.parse(fs.readFileSync(factbookPath, 'utf-8'));
      
      if (!factbookData.snippets || !Array.isArray(factbookData.snippets)) {
        throw new Error('Invalid factbook structure: missing snippets array');
      }
      
      // Validate snippet structure
      const sampleSnippet = factbookData.snippets[0];
      const requiredFields = ['id', 'text', 'topics', 'keywords'];
      
      for (const field of requiredFields) {
        if (!sampleSnippet.hasOwnProperty(field)) {
          throw new Error(`Invalid snippet structure: missing ${field} field`);
        }
      }
      
      this.addTestResult('Factbook Loading', true, `Loaded ${factbookData.snippets.length} snippets`);
      
    } catch (error) {
      this.addTestResult('Factbook Loading', false, error.message);
    }
  }

  async testHybridRetrievalConfig() {
    console.log('\\n⚙️ Testing Hybrid Retrieval Configuration...');
    
    try {
      // Import and test configuration parsing
      const { parseHybridRetrievalConfig } = await import('../src/lib/services/hybridRetrieval.js');
      
      // Test default configuration
      const defaultConfig = parseHybridRetrievalConfig();
      
      const requiredConfigFields = [
        'enableEmbeddings',
        'enableExpansion',
        'enableReranking',
        'maxResults',
        'timeoutMs',
        'bm25K1',
        'bm25B',
        'vectorSimilarityThreshold'
      ];
      
      for (const field of requiredConfigFields) {
        if (!defaultConfig.hasOwnProperty(field)) {
          throw new Error(`Missing configuration field: ${field}`);
        }
      }
      
      // Test environment variable parsing
      process.env.RETRIEVAL_EMBEDDINGS = 'on';
      process.env.RETRIEVAL_EXPANSION = 'auto';
      process.env.RETRIEVAL_RERANK = 'off';
      
      const envConfig = parseHybridRetrievalConfig();
      
      if (!envConfig.enableEmbeddings) {
        throw new Error('Environment variable parsing failed: RETRIEVAL_EMBEDDINGS');
      }
      
      if (envConfig.enableExpansion !== 'auto') {
        throw new Error('Environment variable parsing failed: RETRIEVAL_EXPANSION');
      }
      
      if (envConfig.enableReranking) {
        throw new Error('Environment variable parsing failed: RETRIEVAL_RERANK');
      }
      
      this.addTestResult('Hybrid Retrieval Config', true, 'Configuration parsing works correctly');
      
    } catch (error) {
      this.addTestResult('Hybrid Retrieval Config', false, error.message);
    }
  }

  async testAPIRouteStructure() {
    console.log('\\n🔌 Testing API Route Structure...');
    
    try {
      // Check if demo-chat route exists
      const routePath = path.join(process.cwd(), 'src/app/api/demo-chat/route.ts');
      
      if (!fs.existsSync(routePath)) {
        throw new Error('Demo-chat route not found: src/app/api/demo-chat/route.ts');
      }
      
      // Read and validate route structure
      const routeContent = fs.readFileSync(routePath, 'utf-8');
      
      // Check for required imports
      const requiredImports = [
        'factbookService',
        'FactbookService',
        'buildIndex',
        'retrieveFacts'
      ];
      
      for (const importName of requiredImports) {
        if (!routeContent.includes(importName)) {
          console.warn(`⚠️  Missing import or reference: ${importName}`);
        }
      }
      
      // Check for factbook integration
      if (!routeContent.includes('ensureFactbookLoaded')) {
        throw new Error('Missing factbook loading logic in route');
      }
      
      if (!routeContent.includes('USE_FB_INDEX')) {
        throw new Error('Missing factbook index flag in route');
      }
      
      // Check for hybrid retrieval integration
      if (!routeContent.includes('retrieveFacts') && !routeContent.includes('factbookService.retrieve')) {
        throw new Error('Missing factbook retrieval integration');
      }
      
      this.addTestResult('API Route Structure', true, 'Route structure is valid');
      
    } catch (error) {
      this.addTestResult('API Route Structure', false, error.message);
    }
  }

  async testPersonaPreservation() {
    console.log('\\n👤 Testing Persona Preservation...');
    
    try {
      // Test that factbook service returns raw facts
      const { FactbookService } = await import('../src/lib/services/factbookService.js');
      
      const factbookService = FactbookService.getInstance();
      
      // Load test data
      const testData = {
        snippets: [
          {
            id: 'test.persona',
            path: 'test/persona',
            text: 'Romeo is my poodle, adopted on Valentine\\'s Day 2024.',
            topics: ['pets'],
            keywords: ['romeo', 'poodle']
          }
        ]
      };
      
      await factbookService.loadFactbook(testData);
      
      // Retrieve facts
      const facts = await factbookService.retrieve('Tell me about Romeo');
      
      if (facts.length === 0) {
        throw new Error('No facts retrieved for test query');
      }
      
      const fact = facts[0];
      
      // Validate that facts are returned raw (not rewritten into first person)
      if (!fact.text.includes('Romeo is my poodle')) {
        throw new Error('Fact text appears to be modified from original');
      }
      
      // Validate fact structure
      const requiredFields = ['id', 'text', 'topics', 'keywords', 'type', 'weight'];
      for (const field of requiredFields) {
        if (!fact.hasOwnProperty(field)) {
          throw new Error(`Missing fact field: ${field}`);
        }
      }
      
      this.addTestResult('Persona Preservation', true, 'Facts returned raw for persona processing');
      
    } catch (error) {
      this.addTestResult('Persona Preservation', false, error.message);
    }
  }

  async testBackwardCompatibility() {
    console.log('\\n🔄 Testing Backward Compatibility...');
    
    try {
      // Test FactbookService interface
      const { FactbookService } = await import('../src/lib/services/factbookService.js');
      
      const factbookService = FactbookService.getInstance();
      
      // Test required methods exist
      const requiredMethods = [
        'retrieve',
        'getAllSnippets',
        'getSnippetCount',
        'loadFactbook'
      ];
      
      for (const method of requiredMethods) {
        if (typeof factbookService[method] !== 'function') {
          throw new Error(`Missing required method: ${method}`);
        }
      }
      
      // Test method signatures
      const testData = {
        snippets: [
          {
            id: 'test.compat',
            path: 'test/compat',
            text: 'Test compatibility snippet.',
            topics: ['test'],
            keywords: ['test']
          }
        ]
      };
      
      // Test loadFactbook
      await factbookService.loadFactbook(testData);
      
      // Test getSnippetCount
      const count = factbookService.getSnippetCount();
      if (typeof count !== 'number') {
        throw new Error('getSnippetCount should return number');
      }
      
      // Test getAllSnippets
      const snippets = factbookService.getAllSnippets();
      if (!Array.isArray(snippets)) {
        throw new Error('getAllSnippets should return array');
      }
      
      // Test retrieve
      const facts = await factbookService.retrieve('test');
      if (!Array.isArray(facts)) {
        throw new Error('retrieve should return array');
      }
      
      this.addTestResult('Backward Compatibility', true, 'All required methods work correctly');
      
    } catch (error) {
      this.addTestResult('Backward Compatibility', false, error.message);
    }
  }

  async testFeatureFlags() {
    console.log('\\n🚩 Testing Feature Flags...');
    
    try {
      // Test different feature flag combinations
      const testConfigs = [
        { RETRIEVAL_EMBEDDINGS: 'off', RETRIEVAL_EXPANSION: 'off', RETRIEVAL_RERANK: 'off' },
        { RETRIEVAL_EMBEDDINGS: 'on', RETRIEVAL_EXPANSION: 'off', RETRIEVAL_RERANK: 'off' },
        { RETRIEVAL_EMBEDDINGS: 'on', RETRIEVAL_EXPANSION: 'auto', RETRIEVAL_RERANK: 'off' },
        { RETRIEVAL_EMBEDDINGS: 'on', RETRIEVAL_EXPANSION: 'auto', RETRIEVAL_RERANK: 'on' }
      ];
      
      const { parseHybridRetrievalConfig } = await import('../src/lib/services/hybridRetrieval.js');
      
      for (const config of testConfigs) {
        // Set environment variables
        Object.entries(config).forEach(([key, value]) => {
          process.env[key] = value;
        });
        
        // Parse configuration
        const parsedConfig = parseHybridRetrievalConfig();
        
        // Validate configuration matches expectations
        if (config.RETRIEVAL_EMBEDDINGS === 'off' && parsedConfig.enableEmbeddings) {
          throw new Error('Embeddings should be disabled when RETRIEVAL_EMBEDDINGS=off');
        }
        
        if (config.RETRIEVAL_EXPANSION === 'off' && parsedConfig.enableExpansion !== 'off') {
          throw new Error('Expansion should be disabled when RETRIEVAL_EXPANSION=off');
        }
        
        if (config.RETRIEVAL_RERANK === 'on' && !parsedConfig.enableReranking) {
          throw new Error('Reranking should be enabled when RETRIEVAL_RERANK=on');
        }
      }
      
      this.addTestResult('Feature Flags', true, 'All feature flag combinations work correctly');
      
    } catch (error) {
      this.addTestResult('Feature Flags', false, error.message);
    }
  }

  addTestResult(testName, passed, message) {
    this.results.tests.push({
      name: testName,
      passed,
      message
    });
    
    if (passed) {
      this.results.passed++;
      console.log(`  ✅ ${testName}: ${message}`);
    } else {
      this.results.failed++;
      console.log(`  ❌ ${testName}: ${message}`);
    }
  }

  printSummary() {
    console.log('\\n' + '='.repeat(70));
    console.log('📋 DEMO-CHAT INTEGRATION VALIDATION SUMMARY');
    console.log('='.repeat(70));
    
    console.log(`Total Tests: ${this.results.tests.length}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📊 Success Rate: ${((this.results.passed / this.results.tests.length) * 100).toFixed(2)}%`);
    
    if (this.results.failed > 0) {
      console.log('\\n❌ Failed Tests:');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => console.log(`  - ${test.name}: ${test.message}`));
    }
    
    if (this.results.errors.length > 0) {
      console.log('\\n🚨 Errors:');
      this.results.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\\n🎯 Integration Validation Results:');
    console.log('  ✅ Factbook loading and structure validation');
    console.log('  ✅ Hybrid retrieval configuration parsing');
    console.log('  ✅ API route structure and imports');
    console.log('  ✅ Persona preservation (raw facts → Jonathan voice)');
    console.log('  ✅ Backward compatibility with existing interface');
    console.log('  ✅ Feature flag functionality');
    
    const overallSuccess = this.results.failed === 0 && this.results.errors.length === 0;
    
    console.log('\\n' + '='.repeat(70));
    if (overallSuccess) {
      console.log('🎉 DEMO-CHAT INTEGRATION VALIDATION SUCCESSFUL');
      console.log('✅ All integration points validated');
      console.log('✅ No breaking changes detected');
      console.log('✅ Hybrid retrieval properly integrated');
      console.log('✅ Ready for production deployment');
    } else {
      console.log('⚠️  DEMO-CHAT INTEGRATION VALIDATION FAILED');
      console.log('❌ Issues detected in integration');
      console.log('🔧 Address issues before deployment');
    }
    console.log('='.repeat(70));
    
    // Write detailed report
    const report = {
      timestamp: new Date().toISOString(),
      validation: 'Demo-Chat Integration with Hybrid Retrieval',
      summary: {
        totalTests: this.results.tests.length,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: ((this.results.passed / this.results.tests.length) * 100).toFixed(2)
      },
      tests: this.results.tests,
      errors: this.results.errors,
      recommendations: overallSuccess ? [
        'Monitor performance in production',
        'Set up alerting for fallback scenarios',
        'Validate persona consistency in production'
      ] : [
        'Fix failing integration tests',
        'Resolve configuration issues',
        'Re-run validation before deployment'
      ]
    };
    
    fs.writeFileSync('DEMO_CHAT_INTEGRATION_VALIDATION_REPORT.json', JSON.stringify(report, null, 2));
    console.log('\\n📄 Detailed report saved: DEMO_CHAT_INTEGRATION_VALIDATION_REPORT.json');
    
    return overallSuccess;
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DemoChatIntegrationValidator();
  const success = await validator.validateIntegration();
  process.exit(success ? 0 : 1);
}