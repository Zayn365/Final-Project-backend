const express = require("express");
const cors = require("cors");
const http = require("http");
const dotenv = require("dotenv");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const { Server } = require("socket.io");

dotenv.config();
require("./connection");

const app = express();
const server = http.createServer(app);

// ✅ Allow CORS from all origins (not secure for production)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);

// ✅ Socket.IO also allows all origins
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

// Routes
const User = require("./models/User");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const imageRoutes = require("./routes/imageRoutes");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/images", imageRoutes);

// Stripe endpoint
app.post("/create-payment", async (req, res) => {
  const { amount } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });
    res.status(200).json(paymentIntent);
  } catch (e) {
    console.error(e.message);
    res.status(400).json({ error: e.message });
  }
});

// Example socket usage
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Start server
server.listen(8080, () => {
  console.log("Server running on http://localhost:8080");
});

app.set("socketio", io);
module.exports = app;
