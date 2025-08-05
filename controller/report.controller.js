const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

exports.getOrderReports = async (req, res) => {
  try {
    const { school = "", status = "all" } = req.query;

    const orders = await Order.find();
    const users = await User.find();

    const userTcMap = {}; // key: studentTc, value: { name, schoolName }

    // Map student TCs to user details
    users.forEach((user) => {
      const k12 = user.k12;
      if (!k12?.schoolName || !Array.isArray(k12.students)) return;

      k12.students.forEach((student) => {
        const tc = student.studentTc?.toString();
        const name = `${student.firstName || ""} ${
          student.lastName || ""
        }`.trim();
        if (tc) {
          userTcMap[tc] = {
            student: name,
            tc_id: tc,
            school: k12.schoolName,
          };
        }
      });
    });

    // Get all product IDs
    const productIds = new Set();
    orders.forEach((order) => {
      Object.keys(order.products || {}).forEach((key) => {
        if (key !== "total" && key !== "count") {
          productIds.add(key);
        }
      });
    });

    const productDocs = await Product.find({
      _id: { $in: Array.from(productIds) },
    });
    const productMap = Object.fromEntries(
      productDocs.map((p) => [p._id.toString(), p.name])
    );

    // Build report list
    const reportList = [];

    Object.entries(userTcMap).forEach(([tc_id, studentInfo]) => {
      const studentOrders = orders.filter(
        (order) => order.username?.toString() === tc_id
      );

      const items = studentOrders.flatMap((order) =>
        Object.entries(order.products || {})
          .filter(([key]) => key !== "total" && key !== "count")
          .map(([productId, qty]) => ({
            name: productMap[productId] || "Bilinmeyen Ürün",
            quantity: qty,
          }))
      );

      const total = studentOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      reportList.push({
        ...studentInfo,
        total,
        items,
        hasOrder: items.length > 0,
      });
    });

    // Apply filters
    let filtered = reportList;
    if (school !== "all" && school !== "") {
      filtered = filtered.filter((r) => r.school === school);
    }
    if (status === "have") {
      filtered = filtered.filter((r) => r.hasOrder);
    } else if (status === "no") {
      filtered = filtered.filter((r) => !r.hasOrder);
    }

    return res.status(200).json(filtered);
  } catch (err) {
    console.error("🔥 FULL REPORT ERROR:", err);
    return res.status(500).json({ error: "Rapor verisi alınamadı" });
  }
};
