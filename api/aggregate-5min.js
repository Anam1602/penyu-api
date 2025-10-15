const admin = require("./FirebaseAdmin");

module.exports = async (req, res) => {
  try {
    const db = admin.database();
    const firestore = admin.firestore();

    // Hitung waktu sekarang dalam WIB (UTC+7)
    const nowUTC = Date.now();
    const nowWIB = nowUTC + 7 * 60 * 60 * 1000; // offset ke WIB

    // Buat window 5 menit terakhir (dalam WIB)
    const bucketEnd = nowWIB;
    const bucketStart = bucketEnd - 5 * 60 * 1000; // 5 menit sebelumnya

    const ref = db.ref("kompos_01/raw_history");
    const snapshot = await ref
      .orderByChild("timestamp")
      .startAt(bucketStart)
      .endAt(bucketEnd)
      .get();

    if (!snapshot.exists()) {
      return res
        .status(200)
        .send("OK 5min: avg=null°C, status=Tidak Ada Data, n=0");
    }

    const data = snapshot.val();
    const temps = Object.values(data)
      .map((d) => [d.temp_1, d.temp_2, d.temp_3, d.temp_4])
      .flat()
      .filter((v) => typeof v === "number");

    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;

    // Tentukan status suhu
    let status = "Normal";
    if (avg < 25) status = "Suhu Terlalu Rendah";
    else if (avg > 60) status = "Suhu Terlalu Tinggi";
    else status = "Suhu Ideal";

    // Simpan ke Firestore
    await firestore.collection("compost_readings").add({
      suhu_rata_rata: avg,
      status,
      bucket_start: bucketStart,
      bucket_end: bucketEnd,
      start_iso: new Date(bucketStart).toISOString(),
      end_iso: new Date(bucketEnd).toISOString(),
      source: "raw_history",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res
      .status(200)
      .send(
        `OK 5min: avg=${avg.toFixed(1)}°C, status=${status}, n=${temps.length}`
      );
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).send("Internal Server Error: " + err.message);
  }
};
