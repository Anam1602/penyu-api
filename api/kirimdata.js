const admin = require("firebase-admin");
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Gagal inisialisasi Firebase Admin SDK:", error);
  }
}

const db = admin.firestore();

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ message: "Metode yang diizinkan hanya POST" });
  }

  try {
    const { temp_1, temp_2, temp_3, temp_4 } = req.body;
    if (temp_1 == null || temp_2 == null || temp_3 == null || temp_4 == null) {
      return res.status(400).json({
        success: false,
        message:
          "Data tidak lengkap. Pastikan mengirim temp_1, temp_2, temp_3, dan temp_4.",
      });
    }
    const dataToSave = {
      temp_1: Number(temp_1),
      temp_2: Number(temp_2),
      temp_3: Number(temp_3),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection("compost_readings").add(dataToSave);

    // Kirim respon sukses
    return res.status(200).json({
      success: true,
      message: "Data suhu kompos berhasil disimpan.",
      data: dataToSave,
    });
  } catch (error) {
    console.error("Error saat menyimpan data ke Firestore:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal pada server.",
    });
  }
};
