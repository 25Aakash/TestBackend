const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { verifyToken, isRetailer, isWholesaler } = require('../middleware/auth');
const Retailer = require('../models/Retailer');
const Wholesaler = require('../models/Wholesaler');
const { sendOrderNotification, sendNewOrderNotification } = require('../services/notificationService');
const { generateOrderNumber } = require('../utils/orderNumber');
const { validate, orderSchema } = require('../validators/schemas');
const logger = require('../utils/logger');

const router = express.Router();

// Get retailer's orders
router.get('/my-orders', verifyToken, isRetailer, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const totalOrders = await Order.countDocuments({ retailer_id: req.user.userId });
    const totalPages = Math.ceil(totalOrders / limitNum);
    
    const orders = await Order.find({ retailer_id: req.user.userId })
      .populate('wholesaler_id', 'business_name city phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    logger.debug('Retailer orders fetched', { count: orders.length, userId: req.user.userId });
    res.json({
      orders,
      totalPages,
      currentPage: pageNum,
      totalOrders
    });
  } catch (error) {
    logger.error('Get orders error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get wholesaler's orders
router.get('/received-orders', verifyToken, isWholesaler, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const totalOrders = await Order.countDocuments({ wholesaler_id: req.user.userId });
    const totalPages = Math.ceil(totalOrders / limitNum);
    
    const orders = await Order.find({ wholesaler_id: req.user.userId })
      .populate('retailer_id', 'business_name city phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      orders,
      totalPages,
      currentPage: pageNum,
      totalOrders
    });
  } catch (error) {
    logger.error('Get received orders error', { error: error.message, stack: error.stack });
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
    logger.error('Get order error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// Place order from cart
router.post('/place', verifyToken, isRetailer, validate(orderSchema), async (req, res) => {
  try {
    const { delivery_address, notes } = req.validatedData || req.body;

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

    // Send notifications to wholesalers
    for (const order of createdOrders) {
      const wholesaler = await Wholesaler.findById(order.wholesaler_id);
      if (wholesaler) {
        const retailer = await Retailer.findById(req.user.userId);
        await sendNewOrderNotification(
          wholesaler,
          order._id.toString(),
          order.order_number,
          retailer.business_name
        );
      }
    }

    res.status(201).json({
      message: 'Orders placed successfully',
      orders: createdOrders
    });
  } catch (error) {
    logger.error('Place order error', { error: error.message, stack: error.stack });
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

    // Send notification to retailer
    const retailer = await Retailer.findById(order.retailer_id);
    if (retailer) {
      await sendOrderNotification(
        retailer,
        order._id.toString(),
        status,
        order.order_number
      );
    }

    res.json({
      message: 'Order status updated',
      order
    });
  } catch (error) {
    logger.error('Update order status error', { error: error.message, stack: error.stack });
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
    logger.error('Cancel order error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
