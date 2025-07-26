const router = require("express").Router();
const Order = require("../models/Order");
const User = require("../models/User");

// Creating an order
router.post("/", async (req, res) => {
  const io = req.app.get("socketio");
  const { userId, cart, country, address, username, schoolName } = req.body;

  try {
    const user = await User.findById(userId);

    const order = await Order.create({
      owner: user._id,
      products: cart,
      country,
      address,
      username,
      schoolName,
      count: cart.count,
      total: cart.total,
    });

    user.cart = { total: 0, count: 0 };
    user.orders.push(order);

    const notification = {
      status: "unread",
      message: `New order from ${user.name}`,
      time: new Date(),
    };

    io.sockets.emit("new-order", notification);
    user.notifications.push(notification);
    user.markModified("orders");

    await user.save();

    res.status(200).json(user);
  } catch (e) {
    res.status(400).json(e.message);
  }
});

// Getting all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().populate("owner", ["email", "name"]);
    res.status(200).json(orders);
  } catch (e) {
    res.status(400).json(e.message);
  }
});

// Marking order as shipped
router.patch("/:id/mark-shipped", async (req, res) => {
  const io = req.app.get("socketio");
  const { ownerId } = req.body;
  const { id } = req.params;

  try {
    const user = await User.findById(ownerId);

    await Order.findByIdAndUpdate(id, { status: "shipped" });

    const orders = await Order.find().populate("owner", ["email", "name"]);

    const notification = {
      status: "unread",
      message: `Order ${id} shipped with success`,
      time: new Date(),
    };

    io.sockets.emit("notification", notification, ownerId);
    user.notifications.push(notification);
    await user.save();

    res.status(200).json(orders);
  } catch (e) {
    res.status(400).json(e.message);
  }
});

module.exports = router;
