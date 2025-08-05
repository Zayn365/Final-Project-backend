const router = require("express").Router();
const Product = require("../models/Product");
const User = require("../models/User");

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
    if (!product) {
      return res.status(404).json({ error: "Ürün bulunamadı" });
    }
    if (product.stock < count) {
      return res
        .status(400)
        .json({ error: `Yeterli stok yok. Mevcut stok: ${product.stock}` });
    }
    const user = await User.findById(userId);
    const userCart = user.cart;
    if (userCart[productId]) {
      userCart[productId] += count;
    } else {
      userCart[productId] = count;
    }
    userCart.count += count;
    userCart.total = Number(userCart.total) + Number(price) * count;

    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    // Decrease stock accordingly
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -count } });

    res.status(200).json(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

router.post("/increase-cart", async (req, res) => {
  const { userId, productId, price } = req.body;
  try {
    const user = await User.findById(userId);
    const userCart = user.cart;
    userCart.total += Number(price);
    userCart.count += 1;
    userCart[productId] += 1;
    user.cart = userCart;
    user.markModified("cart");
    await user.save();
    await Product.findByIdAndUpdate(productId, { $inc: { stock: -1 } });
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

    // Check if product exists in cart
    if (!userCart.hasOwnProperty(productId)) {
      return res.status(404).json({ error: "Product not found in cart" });
    }

    const currentQty = Number(userCart[productId]);
    if (isNaN(currentQty) || currentQty <= 0) {
      return res.status(400).json({ error: "Invalid cart quantity" });
    }

    // Decrease quantity
    userCart[productId] = currentQty - 1;

    // If quantity becomes zero, remove product from cart
    if (userCart[productId] <= 0) {
      delete userCart[productId];
    }

    // Update cart total and count safely
    userCart.total -= Number(price);
    if (userCart.total < 0) userCart.total = 0;

    userCart.count -= 1;
    if (userCart.count < 0) userCart.count = 0;

    // Save updated cart
    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    // Restore 1 stock
    await Product.findByIdAndUpdate(productId, { $inc: { stock: 1 } });

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

    if (!userCart.hasOwnProperty(productId)) {
      return res.status(404).json({ error: "Product not found in cart" });
    }

    const removedQty = Number(userCart[productId]);

    // Sanity check
    if (isNaN(removedQty) || removedQty <= 0) {
      return res.status(400).json({ error: "Invalid cart quantity" });
    }

    userCart.total -= removedQty * Number(price);
    if (userCart.total < 0) userCart.total = 0;

    userCart.count -= removedQty;
    if (userCart.count < 0) userCart.count = 0;

    delete userCart[productId];

    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    // Increase stock correctly
    await Product.findByIdAndUpdate(productId, { $inc: { stock: removedQty } });

    res.status(200).json(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

module.exports = router;
