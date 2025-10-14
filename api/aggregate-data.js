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
const rtdb = admin.database();

module.exports = async (req, res) => {
  try {
    console.log("Cron job 'aggregate-data' dimulai...");

    const thirtyMinutesAgo = new Date(
      new Date().getTime() - 30 * 60 * 1000
    ).getTime();

    // Ambil data mentah dari Realtime Database
    const rawDataSnapshot = await rtdb
      .ref("kompos_01/raw_history")
      .orderByChild("timestamp")
      .startAt(thirtyMinutesAgo)
      .get();

    if (!rawDataSnapshot.exists()) {
      console.log("Tidak ada data mentah baru untuk diproses.");
      return res.status(200).send("Tidak ada data mentah baru.");
    }

    const rawData = rawDataSnapshot.val();
    let totalTemp = 0;
    let validReadings = 0;
    const dataCount = Object.keys(rawData).length;

    for (const key in rawData) {
      const data = rawData[key];
      totalTemp +=
        (data.temp_1 || 0) +
        (data.temp_2 || 0) +
        (data.temp_3 || 0) +
        (data.temp_4 || 0);
      validReadings += 4;
    }

    if (validReadings === 0) {
      return res.status(200).send("Tidak ada bacaan suhu yang valid.");
    }

    const averageTemp = totalTemp / validReadings;
    let status = "Suhu Ideal";
    if (averageTemp > 60) status = "Suhu Tinggi";
    else if (averageTemp < 25) status = "Suhu Rendah";

    // Simpan ringkasan ke Firestore
    await db.collection("history_logs").add({
      status: status,
      suhu_rata_rata: averageTemp,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `Ringkasan berhasil disimpan: Rata-rata ${averageTemp.toFixed(
        2
      )}°C, Status: ${status}`
    );
    return res.status(200).send("Agregasi data berhasil.");
  } catch (error) {
    console.error("Error pada cron job 'aggregate-data':", error);
    return res.status(500).send("Terjadi kesalahan pada server.");
  }
};
