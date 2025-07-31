const route = require("express").Router();
const payment = require("../controller/payment.controller");

route.post("/", (req, res) => payment.initiateSepaPayment(req, res));

module.exports = route;
