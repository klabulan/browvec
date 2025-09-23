// Simple script to test OpenAI API key
const fs = require('fs');
const path = require('path');

// Load API key from .env.test
function loadApiKey() {
  const envPath = path.join(process.cwd(), '.env.test');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.startsWith('OPENAI_API_KEY=')) {
        const raw = line.split('=')[1];
        return raw.trim().replace(/^['"]|['"]$/g, ''); // Strip quotes and whitespace
      }
    }
  }
  return null;
}

async function testApiKey() {
  const apiKey = loadApiKey();

  if (!apiKey) {
    console.error('❌ No API key found in .env.test');
    return;
  }

  console.log(`🔑 Testing API key: ${apiKey.substring(0, 20)}...`);
  console.log(`🔍 Key length: ${apiKey.length}`);
  console.log(`🔍 First char code: ${apiKey.charCodeAt(0)} (${apiKey[0]})`);
  console.log(`🔍 Last char code: ${apiKey.charCodeAt(apiKey.length - 1)} (${apiKey[apiKey.length - 1]})`);

  try {
    // Test with a simple embedding request
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: 'test',
        model: 'text-embedding-3-small',
        dimensions: 384
      })
    });

    console.log(`📡 API Response Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API key is working!');
      console.log(`📊 Usage:`, data.usage);
      console.log(`🔢 Embedding dimensions: ${data.data[0].embedding.length}`);
      console.log(`📝 Model: ${data.model}`);
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API call failed:');
      console.error('Status:', response.status);
      console.error('Error:', errorData.error?.message || 'Unknown error');
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

// Run the test
testApiKey();