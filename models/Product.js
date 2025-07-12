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

    age: {
      type: Array,
      required: [false, "can be blank"],
    },
    sizes: {
      type: Array,
      required: [false, "can be blank"],
    },
    pictures: {
      type: Array,
      required: true,
    },
    class: {
      type: Array,
      required: false,
    },
  },
  { minimize: false }
);

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
