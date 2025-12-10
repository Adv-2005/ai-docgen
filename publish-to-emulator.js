// publish-to-emulator.js
const { PubSub } = require('@google-cloud/pubsub');

(async () => {
  const projectId = 'ai-docgen-44b16'; // use the project id shown by emulator logs
  const apiEndpoint = '127.0.0.1:8085'; // host:port your emulator uses
  const pubsub = new PubSub({ projectId, apiEndpoint });

  const topicName = 'analyze-repo';

  try {
    await pubsub.createTopic(topicName);
    console.log('Topic created (or already exists).');
  } catch (e) {
    if (e.code === 6) console.log('Topic exists');
    else console.warn('Create topic error (non-fatal):', e.message);
  }

  const data = JSON.stringify({ repoId: 'test/repo', prNumber: 42 });
  const messageId = await pubsub.topic(topicName).publish(Buffer.from(data));
  console.log('Published messageId:', messageId);
})();
