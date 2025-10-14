const { initAdmin } = require("../_shared/firebaseAdmin");

module.exports = async (req, res) => {
  try {
    const admin = initAdmin();
    const rtdb = admin.database();
    const fs = admin.firestore();

    const snap = await rtdb.ref("kompos_01/readings").get();
    const c = await fs.collection("compost_readings").limit(1).get();

    return res.status(200).json({
      rtdb_ok: snap.exists(),
      firestore_ok: !c.empty,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send(e.stack || e.message || String(e));
  }
};
