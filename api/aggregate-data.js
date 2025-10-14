// api/aggregate-5min.js
const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        "https://proyek-semester-3-default-rtdb.asia-southeast1.firebasedatabase.app",
    });
  } catch (e) {
    console.error("Init Admin gagal:", e);
  }
}

const db = admin.firestore();
const rtdb = admin.database();

const BUCKET_MS = 5 * 60 * 1000;

module.exports = async (req, res) => {
  try {
    // hitung window 5 menit yang BARU SAJA SELESAI (bukan yang sedang berjalan)
    const now = Date.now();
    const currentBucketStart = Math.floor(now / BUCKET_MS) * BUCKET_MS;
    const bucketStart = currentBucketStart - BUCKET_MS;
    const bucketEnd = currentBucketStart - 1;

    // ambil data RTDB dalam rentang ts
    const snap = await rtdb
      .ref("kompos_01/raw_history")
      .orderByChild("timestamp")
      .startAt(bucketStart)
      .endAt(bucketEnd)
      .get();

    if (!snap.exists()) {
      // tetap tulis dokumen kosong supaya idempotent terlihat
      await db.collection("history_logs_5min").doc(String(bucketStart)).set(
        {
          bucket_start: bucketStart,
          bucket_end: bucketEnd,
          count: 0,
          suhu_rata_rata: null,
          status: "Tidak Ada Data",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          source: "rtdb",
          window_ms: BUCKET_MS,
        },
        { merge: false }
      );

      return res.status(200).send("Tidak ada data pada window ini.");
    }

    const raw = snap.val();
    let sum = 0;
    let n = 0;

    // paksa numeric karena di RTDB suhu bisa string
    for (const key in raw) {
      const d = raw[key] || {};
      const vals = [
        Number(d.temp_1) || 0,
        Number(d.temp_2) || 0,
        Number(d.temp_3) || 0,
        Number(d.temp_4) || 0,
      ].filter((x) => x > 0);

      if (vals.length) {
        sum += vals.reduce((a, b) => a + b) / vals.length; // avg per titik
        n++;
      }
    }

    if (n === 0) {
      await db.collection("history_logs_5min").doc(String(bucketStart)).set(
        {
          bucket_start: bucketStart,
          bucket_end: bucketEnd,
          count: 0,
          suhu_rata_rata: null,
          status: "Tidak Ada Data",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          source: "rtdb",
          window_ms: BUCKET_MS,
        },
        { merge: false }
      );

      return res.status(200).send("Tidak ada bacaan valid.");
    }

    const avg = sum / n;

    // klasifikasi telur penyu (Rendah <28, Ideal 28–32, Tinggi >32)
    let status = "Suhu Ideal";
    if (avg > 32) status = "Suhu Tinggi";
    else if (avg < 28) status = "Suhu Rendah";

    // tulis ke Firestore, gunakan docId = bucket_start agar idempotent
    await db.collection("history_logs_5min").doc(String(bucketStart)).set(
      {
        bucket_start: bucketStart,
        bucket_end: bucketEnd,
        count: n,
        suhu_rata_rata: avg,
        status,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        source: "rtdb",
        window_ms: BUCKET_MS,
      },
      { merge: false }
    );

    return res
      .status(200)
      .send(`OK 5min: avg=${avg.toFixed(2)}°C, status=${status}, count=${n}`);
  } catch (err) {
    console.error("aggregate-5min error:", err);
    return res.status(500).send("Terjadi kesalahan pada server.");
  }
};
