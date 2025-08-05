const mongoose = require("mongoose");
const ProductSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "can't be blank"],
    },
    description: {
      type: String,
      required: [true, "can't be blank"],
    },
    price: {
      type: String,
      required: [true, "can't be blank"],
    },
    category: {
      type: String,
      required: [true, "can't be blank"],
    },
    sizes: {
      type: Array,
      required: [false, "can be blank"],
    },
    pictures: {
      type: Array,
      required: true,
    },
    class: { type: [String], required: false }, // 👈 critical fix here
    hasSize: {
      type: Boolean,
      default: false,
      required: [false, "can be blank"],
    },
    hasClass: {
      type: Boolean,
      default: false,
      required: [false, "can be blank"],
    },
    stock: { type: Number, default: 10 },
  },
  { minimize: false }
);

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
