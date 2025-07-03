const app = require("./server");
const mongoose = require("mongoose");

let isConnected = false;

async function handler(req, res) {
  if (!isConnected) {
    await mongoose.connect(
      `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@practicedb.vr32kzn.mongodb.net/Ecom_New`,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
    isConnected = true;
    console.log("✅ MongoDB connected");
  }

  return app(req, res); // Delegate to Express
}

module.exports = handler;
