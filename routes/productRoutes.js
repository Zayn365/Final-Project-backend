const router = require("express").Router();
const Product = require("../models/Product");
const User = require("../models/User");
const mongoose = require("mongoose");

//get products;
router.get("/", async (req, res) => {
  try {
    const sort = { _id: -1 };
    const products = await Product.find().sort(sort);
    res.status(200).json(products);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

//create product
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      images: pictures,
      sizes,
      classNo,
      hasSize,
      hasClass,
      stock,
    } = req.body;
    const product = await Product.create({
      name,
      description,
      price,
      category,
      pictures,
      sizes,
      class: classNo,
      hasSize,
      hasClass,
      stock,
    });
    const products = await Product.find();
    res.status(201).json(products);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// update product

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const {
      name,
      description,
      price,
      category,
      images: pictures,
      classNo,
      sizes,
      hasSize,
      hasClass,
      stock,
    } = req.body;
    const product = await Product.findByIdAndUpdate(id, {
      name,
      description,
      price,
      category,
      pictures,
      class: classNo,
      sizes,
      hasSize,
      hasClass,
      stock,
    });
    const products = await Product.find();
    res.status(200).json(products);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// delete product

router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  try {
    const user = await User.findById(user_id);
    if (!user.isAdmin) return res.status(401).json("You don't have permission");
    await Product.findByIdAndDelete(id);
    const products = await Product.find();
    res.status(200).json(products);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    const similar = await Product.find({ category: product.category }).limit(5);
    res.status(200).json({ product, similar });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

router.get("/disable/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid product ID" });
  }
  try {
    const product = await Product.findById(id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    product.isDisabled = !product.isDisabled;
    await product.save();
    res.status(200).json({ success: true, message: "Ürün durumu güncellendi" });
  } catch (e) {
    console.error("Error in GET /:id:", e);
    res.status(400).send(e.message);
  }
});

router.get("/category/:category", async (req, res) => {
  const { category } = req.params;
  try {
    let products;
    const sort = { _id: -1 };
    if (category == "all") {
      products = await Product.find().sort(sort);
    } else {
      products = await Product.find({ category }).sort(sort);
    }
    res.status(200).json(products);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// cart routes

router.post("/add-to-cart", async (req, res) => {
  const { userId, productId, price, count = 1 } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product || product.stock < count) {
      return res.status(400).json({
        error: `Yeterli stok yok. Mevcut stok: ${product?.stock || 0}`,
      });
    }

    const user = await User.findById(userId);
    const userCart = user.cart;

    // Add or increase quantity
    userCart[productId] = (userCart[productId] || 0) + count;
    userCart.count += count;
    userCart.total += Number(price) * count;

    // Save user
    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    // Update product stock directly
    product.stock = product.stock - count;
    await product.save();

    res.status(200).json(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

router.post("/increase-cart", async (req, res) => {
  const { userId, productId, price } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product || product.stock < 1) {
      return res
        .status(400)
        .json({ error: `Stok kalmadı. Mevcut stok: ${product?.stock || 0}` });
    }

    const user = await User.findById(userId);
    const userCart = user.cart;

    userCart[productId] = (userCart[productId] || 0) + 1;
    userCart.count += 1;
    userCart.total += Number(price);

    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    product.stock -= 1;
    await product.save();

    res.status(200).json(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

router.post("/decrease-cart", async (req, res) => {
  const { userId, productId, price } = req.body;

  try {
    const user = await User.findById(userId);
    const userCart = user.cart;

    if (!userCart[productId] || userCart[productId] <= 0) {
      return res.status(404).json({ error: "Ürün sepette bulunamadı." });
    }

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ error: "Ürün veritabanında bulunamadı." });

    userCart[productId] -= 1;
    if (userCart[productId] <= 0) delete userCart[productId];

    userCart.count = Math.max(0, userCart.count - 1);
    userCart.total = Math.max(0, userCart.total - Number(price));

    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    product.stock += 1;
    await product.save();

    res.status(200).json(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

router.post("/remove-from-cart", async (req, res) => {
  const { userId, productId, price } = req.body;

  try {
    const user = await User.findById(userId);
    const userCart = user.cart;

    const removedQty = userCart[productId];
    if (!removedQty || removedQty <= 0) {
      return res.status(404).json({ error: "Sepette bu ürün yok." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Ürün bulunamadı." });

    // Update cart
    userCart.total = Math.max(0, userCart.total - removedQty * Number(price));
    userCart.count = Math.max(0, userCart.count - removedQty);
    delete userCart[productId];

    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    // Update stock
    product.stock += removedQty;
    await product.save();

    res.status(200).json(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

module.exports = router;
