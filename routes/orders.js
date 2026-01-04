const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { verifyToken, isRetailer, isWholesaler } = require('../middleware/auth');

const router = express.Router();

// Generate unique order number
const generateOrderNumber = async () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Get count of orders today
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const todayOrdersCount = await Order.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });
  
  const sequence = (todayOrdersCount + 1).toString().padStart(4, '0');
  return `ORD${year}${month}${day}${sequence}`;
};

// Get retailer's orders
router.get('/my-orders', verifyToken, isRetailer, async (req, res) => {
  try {
    const orders = await Order.find({ retailer_id: req.user.userId })
      .populate('wholesaler_id', 'business_name city phone')
      .sort({ createdAt: -1 });

    console.log('Retailer orders found:', orders.length);
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get wholesaler's orders
router.get('/received-orders', verifyToken, isWholesaler, async (req, res) => {
  try {
    const orders = await Order.find({ wholesaler_id: req.user.userId })
      .populate('retailer_id', 'business_name city phone')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Get received orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get order by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('retailer_id', 'business_name owner_name phone email business_address')
      .populate('wholesaler_id', 'business_name owner_name phone email business_address')
      .populate('items.product_id', 'name unit_type');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check access rights
    if (
      order.retailer_id._id.toString() !== req.user.userId &&
      order.wholesaler_id._id.toString() !== req.user.userId
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Place order from cart
router.post('/place', verifyToken, isRetailer, async (req, res) => {
  try {
    const { delivery_address, notes } = req.body;

    // Get cart
    const cart = await Cart.findOne({ retailer_id: req.user.userId })
      .populate('items.product_id');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Group items by wholesaler
    const ordersByWholesaler = {};
    
    for (const item of cart.items) {
      const product = item.product_id;
      const wholesalerId = product.wholesaler_id.toString();

      if (!ordersByWholesaler[wholesalerId]) {
        ordersByWholesaler[wholesalerId] = {
          wholesaler_id: wholesalerId,
          items: [],
          subtotal: 0,
          gst_amount: 0
        };
      }

      // Calculate item totals
      const itemSubtotal = item.quantity * item.unit_price;
      const itemGst = (itemSubtotal * product.gst_percentage) / 100;
      const itemTotal = itemSubtotal + itemGst;

      ordersByWholesaler[wholesalerId].items.push({
        product_id: product._id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_amount: itemGst,
        total_price: itemTotal
      });

      ordersByWholesaler[wholesalerId].subtotal += itemSubtotal;
      ordersByWholesaler[wholesalerId].gst_amount += itemGst;
    }

    // Create orders
    const createdOrders = [];
    
    for (const wholesalerId in ordersByWholesaler) {
      const orderData = ordersByWholesaler[wholesalerId];
      
      const order = new Order({
        order_number: await generateOrderNumber(),
        retailer_id: req.user.userId,
        wholesaler_id: wholesalerId,
        items: orderData.items,
        subtotal: orderData.subtotal,
        gst_amount: orderData.gst_amount,
        total_amount: orderData.subtotal + orderData.gst_amount,
        delivery_address: delivery_address || req.retailer.business_address,
        notes
      });

      await order.save();
      createdOrders.push(order);

      // Update product stock
      for (const item of orderData.items) {
        await Product.findByIdAndUpdate(
          item.product_id,
          { $inc: { stock_quantity: -item.quantity } }
        );
      }
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    res.status(201).json({
      message: 'Orders placed successfully',
      orders: createdOrders
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update order status (wholesaler only)
router.put('/:id/status', verifyToken, isWholesaler, async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = status;
    await order.save();

    res.json({
      message: 'Order status updated',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel order (retailer only, if pending)
router.put('/:id/cancel', verifyToken, isRetailer, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      retailer_id: req.user.userId
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending orders' });
    }

    order.status = 'cancelled';
    await order.save();

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product_id,
        { $inc: { stock_quantity: item.quantity } }
      );
    }

    res.json({
      message: 'Order cancelled',
      order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
