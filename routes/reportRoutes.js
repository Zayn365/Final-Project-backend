const express = require("express");
const router = express.Router();
const adminController = require("../controller/report.controller");

// GET /admin/reports/orders?school=...&status=have|no|all
router.get("/orders", adminController.getOrderReports);

module.exports = router;
