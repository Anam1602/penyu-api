const { initAdmin } = require("./_shared/firebaseAdmin");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Hanya POST" });

  try {
    const admin = initAdmin();
    const db = admin.firestore();

    const { temp_1, temp_2, temp_3, temp_4 } = req.body || {};
    if ([temp_1, temp_2, temp_3, temp_4].some((v) => v === undefined)) {
      return res
        .status(400)
        .json({ success: false, message: "temp_1..temp_4 wajib ada" });
    }

    const data = {
      temp_1: Number(temp_1),
      temp_2: Number(temp_2),
      temp_3: Number(temp_3),
      temp_4: Number(temp_4),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("compost_readings").add(data);
    return res.status(200).json({ success: true, message: "Tersimpan", data });
  } catch (e) {
    console.error("kirimdata error:", e);
    return res
      .status(500)
      .json({ success: false, message: e.message || String(e) });
  }
};
