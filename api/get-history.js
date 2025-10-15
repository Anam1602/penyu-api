// api/get-history.js
const admin = require("firebase-admin");

// Init Admin SDK dari env var FIREBASE_CONFIG (Vercel → Project → Settings → Environment Variables)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (err) {
    console.error("Gagal inisialisasi Firebase Admin SDK:", err);
  }
}

const db = admin.firestore();

function classify(avg) {
  // Sesuaikan threshold telur penyu di sini bila perlu
  if (avg > 60) return "Suhu Tinggi"; // versi awalmu
  if (avg < 25) return "Suhu Rendah"; // versi awalmu
  return "Suhu Ideal";
  // Alternatif telur penyu: if (avg > 32) return 'Suhu Tinggi'; if (avg < 28) return 'Suhu Rendah'; return 'Suhu Ideal';
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Metode yang diizinkan hanya GET" });
  }

  try {
    // Query params opsional: ?sinceMs=...&untilMs=...&limit=...
    const sinceMs = req.query.sinceMs ? parseInt(req.query.sinceMs, 10) : null;
    const untilMs = req.query.untilMs ? parseInt(req.query.untilMs, 10) : null;
    const limit = req.query.limit
      ? Math.min(parseInt(req.query.limit, 10), 500)
      : 200;

    // ---------- 1) Coba koleksi hasil agregasi 5 menit ----------
    let q = db.collection("history_logs_5min").orderBy("bucket_start", "desc");
    if (sinceMs) q = q.where("bucket_start", ">=", sinceMs);
    if (untilMs) q = q.where("bucket_start", "<=", untilMs);
    const snap5 = await q.limit(limit).get();

    if (!snap5.empty) {
      const out = snap5.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          status: d.status || "Unknown",
          suhu_rata_rata: Number(d.suhu_rata_rata || 0),
          // tampilkan rentang bucket 5 menit
          bucket_start: d.bucket_start || null,
          bucket_end: d.bucket_end || null,
          // timestamp string untuk kemudahan client
          start_iso: d.bucket_start
            ? new Date(d.bucket_start).toISOString()
            : null,
          end_iso: d.bucket_end ? new Date(d.bucket_end).toISOString() : null,
          source: "history_logs_5min",
        };
      });
      return res.status(200).json(out);
    }

    // ---------- 2) Fallback ke koleksi history_logs (timestamp) ----------
    let q2 = db.collection("history_logs").orderBy("timestamp", "desc");
    // Firestore perlu composite index kalau pakai where + orderBy; jadi kita filter di sisi aplikasi kalau tanpa index
    const snapLegacy = await q2.limit(limit).get();
    if (!snapLegacy.empty) {
      const items = [];
      for (const doc of snapLegacy.docs) {
        const d = doc.data();
        let tsMs = null;
        if (d.timestamp && typeof d.timestamp.toDate === "function") {
          tsMs = d.timestamp.toDate().getTime();
        } else if (typeof d.timestamp === "number") {
          tsMs = d.timestamp;
        }
        if (sinceMs && tsMs && tsMs < sinceMs) continue;
        if (untilMs && tsMs && tsMs > untilMs) continue;

        items.push({
          id: doc.id,
          status: d.status || "Unknown",
          suhu_rata_rata: Number(d.suhu_rata_rata || 0),
          // aproksimasi bucket 5 menit dari timestamp
          bucket_start: tsMs
            ? Math.floor(tsMs / (5 * 60 * 1000)) * (5 * 60 * 1000)
            : null,
          bucket_end: tsMs
            ? Math.floor(tsMs / (5 * 60 * 1000)) * (5 * 60 * 1000) +
              (5 * 60 * 1000 - 1)
            : null,
          start_iso: tsMs ? new Date(tsMs).toISOString() : null,
          end_iso: tsMs ? new Date(tsMs).toISOString() : null,
          source: "history_logs",
        });
      }
      return res.status(200).json(items);
    }

    // ---------- 3) Fallback terakhir: compost_readings (mentah) ----------
    let q3 = db.collection("compost_readings").orderBy("timestamp", "desc");
    const snapRaw = await q3.limit(limit).get();

    if (snapRaw.empty) {
      // Semua kosong
      return res.status(200).json([]);
    }

    // Map compost_readings → hitung avg + status; timestamp bisa Timestamp atau number
    const results = snapRaw.docs.map((doc) => {
      const d = doc.data();
      const t1 = Number(d.temp_1 || 0);
      const t2 = Number(d.temp_2 || 0);
      const t3 = Number(d.temp_3 || 0);
      const t4 = Number(d.temp_4 || 0);
      const valid = [t1, t2, t3, t4].filter((x) => !isNaN(x) && x !== 0);
      const avg = valid.length
        ? valid.reduce((a, b) => a + b, 0) / valid.length
        : 0;

      let tsMs = null;
      if (d.timestamp && typeof d.timestamp.toDate === "function") {
        tsMs = d.timestamp.toDate().getTime();
      } else if (typeof d.timestamp === "number") {
        tsMs = d.timestamp;
      }

      return {
        id: doc.id,
        status: classify(avg),
        suhu_rata_rata: avg,
        bucket_start: tsMs
          ? Math.floor(tsMs / (5 * 60 * 1000)) * (5 * 60 * 1000)
          : null,
        bucket_end: tsMs
          ? Math.floor(tsMs / (5 * 60 * 1000)) * (5 * 60 * 1000) +
            (5 * 60 * 1000 - 1)
          : null,
        start_iso: tsMs ? new Date(tsMs).toISOString() : null,
        end_iso: tsMs ? new Date(tsMs).toISOString() : null,
        source: "compost_readings",
      };
    });

    return res.status(200).json(results);
  } catch (error) {
    console.error("Error get-history:", error);
    return res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan pada server." });
  }
};
