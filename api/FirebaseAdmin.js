// api/FirebaseAdmin.js
const admin = require("firebase-admin");

function initAdmin() {
  if (!admin.apps.length) {
    const raw = JSON.parse(process.env.FIREBASE_CONFIG || "{}");

    // penting: ubah \n yang di-env jadi newline asli
    if (raw.private_key) {
      raw.private_key = raw.private_key.replace(/\\n/g, "\n");
    }

    admin.initializeApp({
      credential: admin.credential.cert(raw),
      // WAJIB untuk akses Realtime Database
      databaseURL:
        raw.databaseURL ||
        `https://${raw.project_id}-default-rtdb.asia-southeast1.firebasedatabase.app`,
    });
  }
  return admin;
}

module.exports = { initAdmin };
