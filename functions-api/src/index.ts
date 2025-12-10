import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const health = functions.https.onRequest((req, res) => {
  res.json({ status: "ok", service: "ai-docgen-api", ts: new Date().toISOString() });
});

export const analyzeRepo = functions.pubsub
  .topic("analyze-repo")
  .onPublish(async (message: functions.pubsub.Message) => {
    const payload = (message.json as any) || {};
    const repoId = payload.repoId || "unknown";
    const prNumber = payload.prNumber ?? null;

    functions.logger.log("analyzeRepo triggered", { repoId, prNumber, payload });

    const db = admin.firestore();
    const now = new Date(); // <-- works on ALL SDK versions

    const resultRef = db.collection("jobResults").doc();

    await resultRef.set({
      repoId,
      prNumber,
      status: "completed",
      note: "Simulated analysis — replace with real logic",
      receivedAt: now,
      resultAt: now,
    });

    return { ok: true };
  });
