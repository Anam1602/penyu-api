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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Metode yang diizinkan hanya GET" });
  }

  try {
    const historySnapshot = await db
      .collection("history_logs")
      .orderBy("timestamp", "desc")
      .get();

    if (historySnapshot.empty) {
      return res.status(200).json([]);
    }

    const historyData = historySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        suhu_rata_rata: data.suhu_rata_rata,
        timestamp: data.timestamp.toDate().toISOString(),
      };
    });

    return res.status(200).json(historyData);
  } catch (error) {
    console.error("Error saat mengambil data history:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
    });
  }
};
