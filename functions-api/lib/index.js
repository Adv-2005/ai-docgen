"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeRepo = exports.health = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
exports.health = functions.https.onRequest((req, res) => {
    res.json({ status: "ok", service: "ai-docgen-api", ts: new Date().toISOString() });
});
exports.analyzeRepo = functions.pubsub
    .topic("analyze-repo")
    .onPublish(async (message) => {
    const payload = message.json || {};
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
