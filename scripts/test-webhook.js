// scripts/test-webhook.js
const crypto = require('crypto');
const fetch = require('node-fetch');

const WEBHOOK_URL = 'http://127.0.0.1:5001/ai-docgen-44b16/us-central1/githubWebhook';
const WEBHOOK_SECRET = 'dev-secret';

/**
 * Generate GitHub-style signature
 */
function generateSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const signature = 'sha256=' + hmac.update(payload).digest('hex');
  return signature;
}

/**
 * Send test PR opened webhook
 */
async function testPROpened() {
  const payload = {
    action: 'opened',
    pull_request: {
      number: 123,
      state: 'open',
      head: {
        sha: 'abc123def456',
        ref: 'feature/new-feature',
      },
      base: {
        ref: 'main',
      },
    },
    repository: {
      id: 123456789,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      owner: {
        login: 'testuser',
      },
    },
    sender: {
      login: 'developer1',
    },
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  console.log('\n🚀 Sending PR Opened webhook...');
  
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'pull_request',
      'X-Hub-Signature-256': signature,
      'X-GitHub-Delivery': crypto.randomUUID(),
    },
    body: payloadString,
  });

  const result = await response.json();
  console.log('Response:', response.status, result);
}

/**
 * Send test push webhook
 */
async function testPush() {
  const payload = {
    ref: 'refs/heads/main',
    before: 'old123abc',
    after: 'new456def',
    repository: {
      id: 123456789,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      owner: {
        login: 'testuser',
      },
    },
    sender: {
      login: 'developer1',
    },
    commits: [
      {
        id: 'commit1',
        message: 'Add new feature',
        modified: ['src/index.ts', 'README.md'],
        added: ['src/new-file.ts'],
        removed: [],
      },
      {
        id: 'commit2',
        message: 'Fix bug',
        modified: ['src/index.ts'],
        added: [],
        removed: [],
      },
    ],
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  console.log('\n🚀 Sending Push webhook...');
  
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'push',
      'X-Hub-Signature-256': signature,
      'X-GitHub-Delivery': crypto.randomUUID(),
    },
    body: payloadString,
  });

  const result = await response.json();
  console.log('Response:', response.status, result);
}

/**
 * Test invalid signature
 */
async function testInvalidSignature() {
  const payload = { test: 'data' };
  const payloadString = JSON.stringify(payload);

  console.log('\n🚀 Testing invalid signature...');
  
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'pull_request',
      'X-Hub-Signature-256': 'sha256=invalidsignature',
      'X-GitHub-Delivery': crypto.randomUUID(),
    },
    body: payloadString,
  });

  console.log('Response:', response.status, await response.text());
}

// Run tests
(async () => {
  try {
    await testPROpened();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testPush();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testInvalidSignature();
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
})();