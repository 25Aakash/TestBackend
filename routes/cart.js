const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { verifyToken, isRetailer } = require('../middleware/auth');

const router = express.Router();

// Get cart
router.get('/', verifyToken, isRetailer, async (req, res) => {
  try {
    const cart = await Cart.findOne({ retailer_id: req.user.userId })
      .populate({
        path: 'items.product_id',
        populate: {
          path: 'wholesaler_id',
          select: 'business_name city'
        }
      });

    if (!cart) {
      return res.json({ items: [], total: 0 });
    }

    // Calculate totals for each item
    const itemsWithTotals = cart.items.map(item => ({
      ...item.toObject(),
      total: item.quantity * item.unit_price
    }));

    const cartTotal = itemsWithTotals.reduce((sum, item) => sum + item.total, 0);

    res.json({
      items: itemsWithTotals,
      total: cartTotal
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to cart
router.post('/add', verifyToken, isRetailer, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    // Get product to validate
    const product = await Product.findById(product_id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.is_active) {
      return res.status(400).json({ error: 'Product is not available' });
    }

    if (quantity < product.moq) {
      return res.status(400).json({ 
        error: `Minimum order quantity is ${product.moq}` 
      });
    }

    if (quantity > product.stock_quantity) {
      return res.status(400).json({ 
        error: `Only ${product.stock_quantity} units available` 
      });
    }

    // Calculate unit price based on quantity
    let unitPrice = product.base_price;
    for (const tier of product.pricing_tiers) {
      if (quantity >= tier.min_quantity) {
        if (tier.max_quantity === null || quantity <= tier.max_quantity) {
          unitPrice = tier.price_per_unit;
          break;
        }
      }
    }

    // Find or create cart
    let cart = await Cart.findOne({ retailer_id: req.user.userId });
    
    if (!cart) {
      cart = new Cart({
        retailer_id: req.user.userId,
        items: []
      });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product_id.toString() === product_id
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity = quantity;
      cart.items[existingItemIndex].unit_price = unitPrice;
    } else {
      // Add new item
      cart.items.push({
        product_id,
        quantity,
        unit_price: unitPrice
      });
    }

    await cart.save();

    res.json({
      message: 'Product added to cart',
      cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update cart item quantity
router.put('/update/:product_id', verifyToken, isRetailer, async (req, res) => {
  try {
    const { quantity } = req.body;
    const { product_id } = req.params;

    const cart = await Cart.findOne({ retailer_id: req.user.userId });
    
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product_id.toString() === product_id
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Product not in cart' });
    }

    // Get product to validate
    const product = await Product.findById(product_id);
    
    if (quantity < product.moq) {
      return res.status(400).json({ 
        error: `Minimum order quantity is ${product.moq}` 
      });
    }

    if (quantity > product.stock_quantity) {
      return res.status(400).json({ 
        error: `Only ${product.stock_quantity} units available` 
      });
    }

    // Recalculate unit price for new quantity
    let unitPrice = product.base_price;
    for (const tier of product.pricing_tiers) {
      if (quantity >= tier.min_quantity) {
        if (tier.max_quantity === null || quantity <= tier.max_quantity) {
          unitPrice = tier.price_per_unit;
          break;
        }
      }
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].unit_price = unitPrice;

    await cart.save();

    res.json({
      message: 'Cart updated',
      cart
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove from cart
router.delete('/remove/:product_id', verifyToken, isRetailer, async (req, res) => {
  try {
    const { product_id } = req.params;

    const cart = await Cart.findOne({ retailer_id: req.user.userId });
    
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cart.items = cart.items.filter(
      item => item.product_id.toString() !== product_id
    );

    await cart.save();

    res.json({
      message: 'Product removed from cart',
      cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear cart
router.delete('/clear', verifyToken, isRetailer, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { retailer_id: req.user.userId },
      { items: [] }
    );

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
