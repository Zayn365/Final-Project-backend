const Order = require("../models/Order");
const Product = require("../models/Product");

/**
 * @route   GET /admin/reports/orders
 * @desc    Get report of all orders with student, school, items, and total
 * @query   ?school=SchoolName&status=have|no|all
 */
exports.getOrderReports = async (req, res) => {
  try {
    const { school = "", status = "all" } = req.query;

    const orders = await Order.find();

    // Collect all product IDs across orders
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

    // Fetch products from DB to map productId → product name
    const productDocs = await Product.find({
      _id: { $in: Array.from(allProductIds) },
    });
    const productMap = Object.fromEntries(
      productDocs.map((p) => [p._id.toString(), p.name])
    );

    // Map orders to report format
    let reportData = orders.map((order) => {
      const itemEntries = Object.entries(order.products || {}).filter(
        ([key]) => key !== "total" && key !== "count"
      );

      const items = itemEntries.map(([productId, qty]) => ({
        name: productMap[productId] || "Bilinmeyen Ürün",
        quantity: qty,
      }));

      return {
        id: order._id,
        student: order.username || "Bilinmiyor",
        school: order.schoolName || "Bilinmiyor",
        total: order.total || 0,
        status: order.status || "unknown",
        items,
        hasOrder: items.length > 0,
      };
    });

    // Apply school filter if provided
    if (school && school !== "all") {
      reportData = reportData.filter((r) => r.school === school);
    }

    // Apply order status filter
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
