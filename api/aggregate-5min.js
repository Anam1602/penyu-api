// api/aggregate-5min/index.js
const admin = require("firebase-admin");

function initAdmin() {
  if (!admin.apps.length) {
    const raw = JSON.parse(process.env.FIREBASE_CONFIG);
    const sa = { ...raw, private_key: raw.private_key.replace(/\\n/g, "\n") };
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        "https://proyek-semester-3-default-rtdb.asia-southeast1.firebasedatabase.app",
    });
  }
  return admin;
}

const BUCKET_MS = 5 * 60 * 1000;

module.exports = async (req, res) => {
  try {
    const admin = initAdmin();
    const rtdb = admin.database();
    const fs = admin.firestore();

    // window 5 menit yang BARU SELESAI
    const now = Date.now();
    const currentStart = Math.floor(now / BUCKET_MS) * BUCKET_MS;
    const bucketStart = currentStart - BUCKET_MS;
    const bucketEnd = currentStart - 1;

    const snap = await rtdb
      .ref("kompos_01/raw_history")
      .orderByChild("timestamp")
      .startAt(bucketStart)
      .endAt(bucketEnd)
      .get();

    let n = 0,
      sum = 0;

    if (snap.exists()) {
      const raw = snap.val();
      for (const k in raw) {
        const d = raw[k] || {};
        const vals = [
          Number(d.temp_1) || 0,
          Number(d.temp_2) || 0,
          Number(d.temp_3) || 0,
          Number(d.temp_4) || 0,
        ].filter((x) => x > 0);
        if (vals.length) {
          sum += vals.reduce((a, b) => a + b) / vals.length;
          n++;
        }
      }
    }

    let avg = null,
      status = "Tidak Ada Data";
    if (n) {
      avg = sum / n;
      status =
        avg > 32 ? "Suhu Tinggi" : avg < 28 ? "Suhu Rendah" : "Suhu Ideal";
    }

    // idempotent: docId = bucket_start
    await fs.collection("history_logs_5min").doc(String(bucketStart)).set(
      {
        bucket_start: bucketStart,
        bucket_end: bucketEnd,
        count: n,
        suhu_rata_rata: avg,
        status,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        window_ms: BUCKET_MS,
        source: "rtdb",
      },
      { merge: false }
    );

    return res
      .status(200)
      .send(
        `OK 5min: avg=${
          avg?.toFixed ? avg.toFixed(2) : "null"
        }°C, status=${status}, n=${n}`
      );
  } catch (e) {
    console.error("aggregate-5min error:", e);
    return res.status(500).send(e.stack || e.message || String(e));
  }
};
