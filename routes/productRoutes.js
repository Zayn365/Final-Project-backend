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
  const { userId, productId, price } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user.cart) {
      user.cart = {
        count: 0,
        total: 0,
        items: {},
      };
    }

    const userCart = user.cart;

    if (userCart.items[productId]) {
      userCart.items[productId].quantity += 1;
    } else {
      userCart.items[productId] = {
        quantity: 1,
        price: Number(price), // Final discounted price
      };
    }

    userCart.count += 1;
    userCart.total = Object.values(userCart.items).reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    user.cart = userCart;
    user.markModified("cart");
    await user.save();

    res.status(200).json(user);
  } catch (e) {
    console.error("Add to cart failed:", e.message);
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
    userCart.total -= Number(price);
    userCart.count -= 1;
    userCart[productId] -= 1;
    user.cart = userCart;
    user.markModified("cart");
    await user.save();
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
    userCart.total -= Number(userCart[productId]) * Number(price);
    userCart.count -= userCart[productId];
    delete userCart[productId];
    user.cart = userCart;
    user.markModified("cart");
    await user.save();
    res.status(200).json(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

module.exports = router;
