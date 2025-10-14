// api/aggregate-data.js
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
  } catch (error) {
    console.error("Gagal inisialisasi Firebase Admin SDK:", error);
  }
}

const db = admin.firestore();
const rtdb = admin.database();

module.exports = async (req, res) => {
  try {
    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000;

    // Ambil data mentah dari RTDB
    const snap = await rtdb
      .ref("kompos_01/raw_history")
      .orderByChild("timestamp")
      .startAt(thirtyMinutesAgo)
      .get();

    if (!snap.exists()) {
      return res.status(200).send("Tidak ada data mentah baru.");
    }

    const raw = snap.val();
    let sum = 0;
    let count = 0;

    for (const key in raw) {
      const d = raw[key] || {};
      const v = [
        Number(d.temp_1) || 0,
        Number(d.temp_2) || 0,
        Number(d.temp_3) || 0,
        Number(d.temp_4) || 0,
      ];
      // hitung rata-rata satu titik, abaikan nol kosong
      const vals = v.filter((x) => x > 0);
      if (vals.length) {
        sum += vals.reduce((a, b) => a + b) / vals.length;
        count++;
      }
    }

    if (!count) return res.status(200).send("Tidak ada bacaan valid.");

    const avg = sum / count;
    let status = "Suhu Ideal";
    if (avg > 32) status = "Suhu Tinggi";
    else if (avg < 28) status = "Suhu Rendah";

    await db.collection("history_logs").add({
      suhu_rata_rata: avg,
      status,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      window_ms: 30 * 60 * 1000,
    });

    return res
      .status(200)
      .send(`OK. Avg=${avg.toFixed(2)}°C, Status=${status}, Count=${count}`);
  } catch (err) {
    console.error("Error aggregate-data:", err);
    return res.status(500).send("Terjadi kesalahan pada server.");
  }
};
