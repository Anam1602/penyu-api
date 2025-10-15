// api/aggregate-5min.js
const { initAdmin } = require("./FirebaseAdmin"); // ← destructure
module.exports = async (req, res) => {
  try {
    const admin = initAdmin(); // ← panggil helper → dapat instance
    const rtdb = admin.database();
    const firestore = admin.firestore();

    // Waktu WIB (UTC+7)
    const nowUTC = Date.now();
    const nowWIB = nowUTC + 7 * 60 * 60 * 1000;

    // Window 5 menit terakhir (WIB)
    const bucketEnd = nowWIB;
    const bucketStart = bucketEnd - 5 * 60 * 1000;

    // Query RTDB (pastikan rules punya .indexOn: ["timestamp"])
    const snap = await rtdb
      .ref("kompos_01/raw_history")
      .orderByChild("timestamp")
      .startAt(bucketStart)
      .endAt(bucketEnd)
      .get();

    if (!snap.exists()) {
      return res
        .status(200)
        .send("OK 5min: avg=null°C, status=Tidak Ada Data, n=0");
    }

    const rows = Object.values(snap.val());
    const temps = rows
      .map((d) => [d.temp_1, d.temp_2, d.temp_3, d.temp_4])
      .flat()
      .filter((v) => typeof v === "number");

    const n = temps.length;
    const avg = n ? temps.reduce((a, b) => a + b, 0) / n : null;

    let status = "Suhu Ideal";
    if (avg === null) status = "Tidak Ada Data";
    else if (avg < 25) status = "Suhu Terlalu Rendah";
    else if (avg > 60) status = "Suhu Terlalu Tinggi";

    // Simpan ringkasan ke Firestore
    await firestore.collection("history_logs_5min").add({
      suhu_rata_rata: avg,
      status,
      bucket_start: bucketStart,
      bucket_end: bucketEnd,
      start_iso: new Date(bucketStart).toISOString(),
      end_iso: new Date(bucketEnd).toISOString(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      source: "raw_history",
    });

    return res
      .status(200)
      .send(
        `OK 5min: avg=${
          avg?.toFixed?.(1) ?? "null"
        }°C, status=${status}, n=${n}`
      );
  } catch (e) {
    console.error("AGGREGATE-5MIN ERROR:", e);
    return res.status(500).send("Internal Server Error: " + (e.message || e));
  }
};
