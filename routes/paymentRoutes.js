const route = require("express").Router();
const payment = require("../controller/payment.controller");

route.post("/", (req, res) => payment.initiateSepaPayment(req, res));
route.post("/card", (req, res) => payment.payWithCard(req, res));
route.post("/link", (req, res) => payment.payByLink(req, res));
route.post("/3d-session", (req, res) =>
  payment.generate3DSecureSession(req, res)
);
// routes/payment.js
route.post("/result", (req, res) => {
  const paymentResult = req.body;
  const redirectUrl = `https://store.bikev.k12.tr/payment/result?status=${
    paymentResult.status
  }&message=${paymentResult.responseMsg || "OK"}`;
  res.redirect(302, redirectUrl);
});

module.exports = route;
