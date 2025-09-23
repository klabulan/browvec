// Test if embedding imports work in the demo
const fs = require('fs');

// Try to load the built SDK and check exports
async function testImports() {
  try {
    console.log('🔍 Testing SDK imports...');

    // Read the built SDK file to see what's exported
    const sdkPath = './dist/localretrieve.mjs';
    if (fs.existsSync(sdkPath)) {
      const sdkContent = fs.readFileSync(sdkPath, 'utf8');

      // Look for embedding-related exports
      const exports = [];
      const exportMatches = sdkContent.match(/export\s*{\s*([^}]+)\s*}/g) || [];
      exportMatches.forEach(match => {
        const exportNames = match.match(/export\s*{\s*([^}]+)\s*}/)[1];
        exports.push(...exportNames.split(',').map(name => name.trim()));
      });

      console.log('📦 Found exports:', exports);

      // Check for embedding-specific exports
      const embeddingExports = exports.filter(exp =>
        exp.includes('embedding') ||
        exp.includes('provider') ||
        exp.includes('Provider') ||
        exp.includes('create') ||
        exp.includes('validate')
      );

      console.log('🎯 Embedding-related exports:', embeddingExports);

      // Check if we can see the specific functions we need
      const hasCreateProvider = sdkContent.includes('createProvider');
      const hasValidateProviderConfig = sdkContent.includes('validateProviderConfig');

      console.log('✅ Has createProvider:', hasCreateProvider);
      console.log('✅ Has validateProviderConfig:', hasValidateProviderConfig);

      if (!hasCreateProvider || !hasValidateProviderConfig) {
        console.log('❌ Missing required embedding functions in SDK build');
      }

    } else {
      console.log('❌ SDK file not found at', sdkPath);
    }

  } catch (error) {
    console.error('❌ Error testing imports:', error.message);
  }
}

testImports();