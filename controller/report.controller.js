const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

exports.getOrderReports = async (req, res) => {
  try {
    const { school = "", status = "all" } = req.query;

    // Step 1: Fetch orders with user populated
    const orders = await Order.find().populate("userId");

    // Step 2: Collect product IDs
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

    // Step 3: Map product IDs to product names
    const productDocs = await Product.find({
      _id: { $in: Array.from(allProductIds) },
    });
    const productMap = Object.fromEntries(
      productDocs.map((p) => [p._id.toString(), p.name])
    );

    // Step 4: Build report data
    let reportData = orders.map((order) => {
      const itemEntries = Object.entries(order.products || {}).filter(
        ([key]) => key !== "total" && key !== "count"
      );

      const items = itemEntries.map(([productId, qty]) => ({
        name: productMap[productId] || "Bilinmeyen Ürün",
        quantity: qty,
      }));

      // Get user info from populated field
      const user = order.userId;
      const tc_id = user?.tc_id || "";
      const studentName = user?.name || "Bilinmiyor";
      const schoolName =
        user?.k12?.schoolName || order.schoolName || "Bilinmiyor";

      return {
        id: order._id,
        student: studentName,
        tc_id,
        school: schoolName,
        total: order.total || 0,
        status: order.status || "unknown",
        items,
        hasOrder: items.length > 0,
      };
    });

    // Step 5: Apply filters
    if (school && school !== "all") {
      reportData = reportData.filter((r) => r.school === school);
    }

    if (status === "have") {
      reportData = reportData.filter((r) => r.hasOrder);
    } else if (status === "no") {
      reportData = reportData.filter((r) => !r.hasOrder);
    }

    res.status(200).json(reportData);
  } catch (error) {
    console.error("Error generating order reports:", error.message);
    res.status(500).json({ error: "Rapor verisi alınamadı" });
  }
};
