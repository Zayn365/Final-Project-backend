const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

exports.getOrderReports = async (req, res) => {
  try {
    const { school = "", status = "all" } = req.query;

    // 1. Get orders
    const orders = await Order.find();
    console.log("Total orders:", orders.length);

    // 2. Get all users once
    const users = await User.find();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    // 3. Collect product IDs
    const allProductIds = new Set();
    for (const order of orders) {
      if (order.products) {
        Object.keys(order.products).forEach((key) => {
          if (key !== "total" && key !== "count") {
            allProductIds.add(key);
          }
        });
      }
    }

    // 4. Map product IDs to names
    const productDocs = await Product.find({
      _id: { $in: Array.from(allProductIds) },
    });
    const productMap = Object.fromEntries(
      productDocs.map((p) => [p._id.toString(), p.name])
    );

    // 5. Build report
    const reportData = orders.map((order) => {
      const user = userMap[order.owner?.toString()] || {}; // FIXED

      const itemEntries = Object.entries(order.products || {}).filter(
        ([key]) => key !== "total" && key !== "count"
      );

      const items = itemEntries.map(([productId, qty]) => ({
        name: productMap[productId] || "Bilinmeyen Ürün",
        quantity: qty,
      }));

      return {
        id: order._id,
        student: user.name || "Bilinmiyor",
        tc_id: user.tc_id || "",
        school: user.k12?.schoolName || order.schoolName || "Bilinmiyor",
        total: order.total || 0,
        status: order.status || "unknown",
        items,
        hasOrder: items.length > 0,
      };
    });

    // 6. Apply filters
    let filtered = reportData;
    if (school && school !== "all") {
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
