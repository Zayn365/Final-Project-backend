const mongoose = require("mongoose");
const CampaignSchema = mongoose.Schema(
  {
    products: {
      type: Array,
    },
    start_Date: {
      type: String,
      default: new Date().toISOString().split("T")[0],
    },
    end_date: {
      type: String,
      default: new Date().toISOString().split("T")[0],
    },
    type: {
      type: String,
    },
    amount: {
      type: Number,
    },
    users: {
      type: String,
    },
  },
  { minimize: false }
);

const Campaign = mongoose.model("Campaign", CampaignSchema);

module.exports = Campaign;
