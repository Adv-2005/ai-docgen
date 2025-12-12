// scripts/trigger-queued-jobs.js
// This script reads from pubsubQueue and publishes to the actual Pub/Sub emulator

const { PubSub } = require('@google-cloud/pubsub');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ai-docgen-44b16',
});

// Initialize Pub/Sub for emulator
const pubsub = new PubSub({
  projectId: 'ai-docgen-44b16',
  apiEndpoint: '127.0.0.1:8085',
});

const db = admin.firestore();

// Connect to Firestore emulator
db.settings({
  host: '127.0.0.1:8080',
  ssl: false,
});

async function processQueue() {
  console.log('🔍 Checking for queued messages...\n');

  const snapshot = await db
    .collection('pubsubQueue')
    .where('published', '==', false)
    .get();

  if (snapshot.empty) {
    console.log('✅ No messages in queue\n');
    return;
  }

  console.log(`📨 Found ${snapshot.size} message(s) to publish\n`);

  for (const doc of snapshot.docs) {
    const queueItem = doc.data();
    const { topic, data } = queueItem;

    try {
      // Ensure topic exists
      try {
        await pubsub.createTopic(topic);
        console.log(`✅ Topic '${topic}' created (or already exists)`);
      } catch (e) {
        if (e.code === 6) {
          console.log(`✅ Topic '${topic}' already exists`);
        }
      }

      // Publish message
      const messageData = JSON.stringify(data);
      const messageId = await pubsub.topic(topic).publish(Buffer.from(messageData));
      
      console.log(`✅ Published to '${topic}' - Message ID: ${messageId}`);
      console.log(`   Data:`, data);

      // Mark as published
      await doc.ref.update({
        published: true,
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId,
      });

      console.log(`✅ Marked queue item as published\n`);

    } catch (error) {
      console.error(`❌ Failed to publish message:`, error.message);
      
      // Update with error
      await doc.ref.update({
        error: error.message,
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  console.log('🎉 Queue processing complete!\n');
}

// Run the processor
(async () => {
  try {
    await processQueue();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();