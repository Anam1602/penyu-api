module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    message: "Halo dari endpoint hello.js!",
    file: "api/hello.js",
    method: req.method,
  });
};
