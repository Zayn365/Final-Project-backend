const route = require("express").Router();
const payment = require("../controller/payment.controller");

route.post("/", (req, res) => payment.initiateSepaPayment(req, res));
route.post("/card", (req, res) => payment.payWithCard(req, res));
route.post("/link", (req, res) => payment.payByLink(req, res));

module.exports = route;
