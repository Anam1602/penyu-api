const { initAdmin } = require("../_shared/firebaseAdmin");

module.exports = async (req, res) => {
  try {
    const admin = initAdmin();
    const rtdb = admin.database();
    const fs = admin.firestore();

    const now = Date.now();
    const from = now - 30 * 60 * 1000;

    const snap = await rtdb
      .ref("kompos_01/raw_history")
      .orderByChild("timestamp")
      .startAt(from)
      .get();

    if (!snap.exists())
      return res.status(200).send("Tidak ada data mentah baru.");

    const raw = snap.val();
    let sum = 0,
      n = 0;

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
    if (!n) return res.status(200).send("Tidak ada bacaan valid.");

    const avg = sum / n;
    let status = "Suhu Ideal";
    if (avg > 32) status = "Suhu Tinggi";
    else if (avg < 28) status = "Suhu Rendah";

    await fs.collection("history_logs").add({
      suhu_rata_rata: avg,
      status,
      window_ms: 30 * 60 * 1000,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: "rtdb",
    });

    return res
      .status(200)
      .send(`OK 30min: avg=${avg.toFixed(2)}°C, status=${status}, n=${n}`);
  } catch (e) {
    console.error("aggregate-data error:", e);
    return res.status(500).send(e.stack || e.message || String(e));
  }
};
