// Reuse Admin app across functions: require() cache akan menjaga single init.
const admin = require("firebase-admin");

function initAdmin() {
  if (!admin.apps.length) {
    const raw = JSON.parse(process.env.FIREBASE_CONFIG);
    const sa = {
      ...raw,
      // penting: private_key multiline
      private_key: raw.private_key.replace(/\\n/g, "\n"),
    };
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return admin;
}

module.exports = { initAdmin };
