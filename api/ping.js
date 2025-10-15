// api/ping.js
const { initAdmin } = require("./FirebaseAdmin"); // perhatikan huruf besar-kecil

module.exports = async (req, res) => {
  try {
    const admin = initAdmin();
    const rtdb = admin.database();
    const fs = admin.firestore();

    const snap = await rtdb.ref("kompos_01/readings").get();
    const c = await fs.collection("compost_readings").limit(1).get();

    res.status(200).json({
      ok: true,
      rtdb_ok: snap.exists(),
      firestore_ok: !c.empty,
    });
  } catch (e) {
    console.error("PING ERROR:", e);
    res
      .status(500)
      .json({ ok: false, error: e.stack || e.message || String(e) });
  }
};
