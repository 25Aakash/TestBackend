const express = require('express');
const bcrypt = require('bcryptjs');
const Salesman = require('../models/Salesman');
const Retailer = require('../models/Retailer');
const Connection = require('../models/Connection');
const { verifyToken, isWholesaler, isSalesman, isWholesalerOrSalesman } = require('../middleware/auth');

const router = express.Router();

// ==================== WHOLESALER ROUTES ====================

// Get all salesmen for a wholesaler
router.get('/my-salesmen', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can access this' });
    }

    const salesmen = await Salesman.find({ wholesaler_id: req.user.userId })
      .select('-password')
      .sort({ created_at: -1 });

    res.json(salesmen);
  } catch (error) {
    console.error('Get salesmen error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new salesman (wholesaler only)
router.post('/create', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can create salesmen' });
    }

    const { name, email, phone, permissions } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Check if phone already exists
    const existingByPhone = await Salesman.findOne({ phone });
    if (existingByPhone) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Check if email exists (only if email is provided)
    if (email && email.trim()) {
      const existingByEmail = await Salesman.findOne({ email: email.toLowerCase().trim() });
      if (existingByEmail) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    // Use phone as temporary password - they will set their own on first login
    const hashedPassword = await bcrypt.hash(phone, 10);

    // Default permissions if not provided
    const salesmanPermissions = permissions || {
      can_add_products: true,
      can_delete_products: false,
      can_add_brands: true,
      can_add_retailers: true,
      can_delete_retailers: false,
      can_view_all_retailers: true,
      can_place_orders: true
    };

    const salesman = new Salesman({
      wholesaler_id: req.user.userId,
      name,
      email: email && email.trim() ? email.toLowerCase().trim() : undefined,
      phone,
      password: hashedPassword,
      requires_password_setup: true,
      permissions: salesmanPermissions
    });

    await salesman.save();

    res.status(201).json({
      message: 'Salesman created successfully. They can login with their phone number as temporary password.',
      salesman: {
        _id: salesman._id,
        name: salesman.name,
        email: salesman.email,
        phone: salesman.phone,
        is_active: salesman.is_active,
        permissions: salesman.permissions,
        created_at: salesman.created_at
      }
    });
  } catch (error) {
    console.error('Create salesman error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update salesman (wholesaler only)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can update salesmen' });
    }

    const { name, email, phone, password, is_active, permissions } = req.body;

    const salesman = await Salesman.findOne({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    // Check for duplicate email/phone (excluding current salesman)
    if (email || phone) {
      const duplicate = await Salesman.findOne({
        _id: { $ne: req.params.id },
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : [])
        ]
      });

      if (duplicate) {
        return res.status(400).json({ error: 'Email or phone already in use' });
      }
    }

    if (name) salesman.name = name;
    if (email) salesman.email = email.toLowerCase().trim();
    if (phone) salesman.phone = phone;
    if (typeof is_active === 'boolean') salesman.is_active = is_active;
    
    // Update permissions if provided
    if (permissions) {
      salesman.permissions = {
        ...salesman.permissions,
        ...permissions
      };
    }
    
    if (password) {
      salesman.password = await bcrypt.hash(password, 10);
    }

    await salesman.save();

    res.json({
      message: 'Salesman updated successfully',
      salesman: {
        _id: salesman._id,
        name: salesman.name,
        email: salesman.email,
        phone: salesman.phone,
        is_active: salesman.is_active,
        permissions: salesman.permissions
      }
    });
  } catch (error) {
    console.error('Update salesman error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete salesman (wholesaler only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can delete salesmen' });
    }

    const salesman = await Salesman.findOneAndDelete({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    res.json({ message: 'Salesman deleted successfully' });
  } catch (error) {
    console.error('Delete salesman error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get retailers added by salesmen (pending approval) - wholesaler only
router.get('/pending-retailers', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can access this' });
    }

    // Find connections requested by salesmen that are pending
    const pendingConnections = await Connection.find({
      wholesaler_id: req.user.userId,
      requested_by: 'salesman',
      status: 'pending'
    }).populate('retailer_id', 'business_name owner_name phone city');

    // Get salesman details for each connection
    const connectionsWithSalesman = await Promise.all(
      pendingConnections.map(async (conn) => {
        const salesman = await Salesman.findById(conn.salesman_id).select('name');
        return {
          _id: conn._id,
          retailer: conn.retailer_id,
          salesman_name: salesman?.name || 'Unknown',
          salesman_id: conn.salesman_id,
          message: conn.message,
          createdAt: conn.createdAt
        };
      })
    );

    res.json(connectionsWithSalesman);
  } catch (error) {
    console.error('Get pending retailers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SALESMAN ROUTES ====================

// Get salesman profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const salesman = await Salesman.findById(req.user.userId)
      .select('-password')
      .populate('wholesaler_id', 'business_name');

    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    res.json(salesman);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new retailer (salesman only)
router.post('/add-retailer', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can add retailers' });
    }

    const {
      business_name,
      owner_name,
      email,
      phone,
      password,
      gst_number,
      business_address,
      city,
      state,
      pincode,
      message
    } = req.body;

    // Get salesman to find wholesaler
    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    // Normalize values
    const normalizedGstNumber = gst_number && gst_number.trim() ? gst_number.trim() : undefined;
    const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : undefined;

    // Check if retailer already exists
    const existingChecks = [{ phone }];
    if (normalizedEmail) {
      existingChecks.push({ email: normalizedEmail });
    }
    if (normalizedGstNumber) {
      existingChecks.push({ gst_number: normalizedGstNumber });
    }

    let retailer = await Retailer.findOne({ $or: existingChecks });

    if (retailer) {
      // Retailer exists, check if connection already exists
      const existingConnection = await Connection.findOne({
        wholesaler_id: salesman.wholesaler_id,
        retailer_id: retailer._id
      });

      if (existingConnection) {
        return res.status(400).json({ 
          error: 'This retailer is already connected or has a pending request' 
        });
      }
    } else {
      // Create new retailer - use phone as temp password, they will set their own on first login
      const hashedPassword = await bcrypt.hash(phone, 10);

      retailer = new Retailer({
        business_name,
        owner_name,
        email: normalizedEmail,
        phone,
        password: hashedPassword,
        gst_number: normalizedGstNumber,
        business_address,
        city,
        state,
        pincode,
        requires_password_setup: true
      });

      await retailer.save();
    }

    // Create connection request (pending approval from wholesaler)
    const connection = new Connection({
      wholesaler_id: salesman.wholesaler_id,
      retailer_id: retailer._id,
      status: 'pending',
      requested_by: 'salesman',
      salesman_id: req.user.userId,
      message: message || `Added by ${salesman.name}`
    });

    await connection.save();

    res.status(201).json({
      message: 'Retailer added successfully. Pending wholesaler approval.',
      retailer: {
        _id: retailer._id,
        business_name: retailer.business_name,
        owner_name: retailer.owner_name,
        phone: retailer.phone,
        city: retailer.city
      }
    });
  } catch (error) {
    console.error('Add retailer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get retailers for this salesman (includes all retailers if can_view_all_retailers is true)
router.get('/my-retailers', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    console.log('Salesman:', salesman.name, 'Permissions:', salesman.permissions);

    let connections;

    if (salesman.permissions?.can_view_all_retailers) {
      // Show ALL retailers connected to this wholesaler (approved only from others)
      // Plus show own pending retailers
      connections = await Connection.find({
        wholesaler_id: salesman.wholesaler_id,
        $or: [
          { status: 'approved' },  // All approved connections
          { salesman_id: req.user.userId }  // Plus all own connections (any status)
        ]
      }).populate('retailer_id', 'business_name owner_name phone city state');
    } else {
      // Only show retailers added by this salesman (any status)
      connections = await Connection.find({
        wholesaler_id: salesman.wholesaler_id,
        salesman_id: req.user.userId
      }).populate('retailer_id', 'business_name owner_name phone city state');
    }

    console.log('Found connections:', connections.length);

    const retailers = connections
      .filter(conn => conn.retailer_id) // Filter out any null retailer refs
      .map(conn => ({
        _id: conn.retailer_id._id,
        business_name: conn.retailer_id.business_name,
        owner_name: conn.retailer_id.owner_name,
        phone: conn.retailer_id.phone,
        city: conn.retailer_id.city,
        state: conn.retailer_id.state,
        status: conn.status,
        connection_id: conn._id,
        added_by_me: conn.salesman_id?.toString() === req.user.userId,
        added_by: conn.requested_by === 'wholesaler' ? 'Wholesaler' : 
                  conn.requested_by === 'retailer' ? 'Retailer' :
                  (conn.salesman_id?.toString() === req.user.userId ? 'You' : 'Other Salesman')
      }));

    res.json(retailers);
  } catch (error) {
    console.error('Get my retailers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get salesman permissions
router.get('/my-permissions', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    res.json({
      permissions: salesman.permissions || {
        can_add_products: true,
        can_delete_products: false,
        can_add_brands: true,
        can_add_retailers: true,
        can_delete_retailers: false,
        can_view_all_retailers: true,
        can_place_orders: true
      }
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SALESMAN CART & ORDER ROUTES ====================

const Product = require('../models/Product');
const Order = require('../models/Order');

// Get salesman's temporary cart (stored in memory/session - we'll use a simple approach)
// Using a SalesmanCart model for persistent cart per salesman-retailer combo
const mongoose = require('mongoose');

// Define SalesmanCart schema inline (or could be separate file)
const salesmanCartSchema = new mongoose.Schema({
  salesman_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salesman',
    required: true
  },
  retailer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: true
  },
  wholesaler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wholesaler',
    required: true
  },
  items: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit_price: {
      type: Number,
      required: true
    }
  }],
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

salesmanCartSchema.index({ salesman_id: 1, retailer_id: 1 }, { unique: true });

const SalesmanCart = mongoose.models.SalesmanCart || mongoose.model('SalesmanCart', salesmanCartSchema);

// Get cart for a specific retailer
router.get('/cart/:retailer_id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    if (!salesman.permissions?.can_place_orders) {
      return res.status(403).json({ error: 'You do not have permission to place orders' });
    }

    const cart = await SalesmanCart.findOne({
      salesman_id: req.user.userId,
      retailer_id: req.params.retailer_id
    }).populate({
      path: 'items.product_id',
      select: 'name base_price gst_percentage unit_type stock_quantity images'
    });

    if (!cart) {
      return res.json({ items: [], total: 0 });
    }

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
    console.error('Get salesman cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to cart for a retailer
router.post('/cart/:retailer_id/add', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    if (!salesman.permissions?.can_place_orders) {
      return res.status(403).json({ error: 'You do not have permission to place orders' });
    }

    const { product_id, quantity } = req.body;
    const retailer_id = req.params.retailer_id;

    // Verify retailer is connected to this wholesaler
    const connection = await Connection.findOne({
      wholesaler_id: salesman.wholesaler_id,
      retailer_id: retailer_id,
      status: 'approved'
    });

    if (!connection) {
      return res.status(400).json({ error: 'Retailer is not connected to your wholesaler' });
    }

    // Get product to validate
    const product = await Product.findById(product_id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.wholesaler_id.toString() !== salesman.wholesaler_id.toString()) {
      return res.status(400).json({ error: 'Product does not belong to your wholesaler' });
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
    if (product.pricing_tiers && product.pricing_tiers.length > 0) {
      for (const tier of product.pricing_tiers) {
        if (quantity >= tier.min_quantity) {
          if (tier.max_quantity === null || quantity <= tier.max_quantity) {
            unitPrice = tier.price_per_unit;
            break;
          }
        }
      }
    }

    // Find or create cart
    let cart = await SalesmanCart.findOne({
      salesman_id: req.user.userId,
      retailer_id: retailer_id
    });
    
    if (!cart) {
      cart = new SalesmanCart({
        salesman_id: req.user.userId,
        retailer_id: retailer_id,
        wholesaler_id: salesman.wholesaler_id,
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
      itemCount: cart.items.length
    });
  } catch (error) {
    console.error('Add to salesman cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update cart item
router.put('/cart/:retailer_id/update/:product_id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const { quantity } = req.body;
    const { retailer_id, product_id } = req.params;

    const cart = await SalesmanCart.findOne({
      salesman_id: req.user.userId,
      retailer_id: retailer_id
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product_id.toString() === product_id
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Product not in cart' });
    }

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

    // Recalculate unit price
    let unitPrice = product.base_price;
    if (product.pricing_tiers && product.pricing_tiers.length > 0) {
      for (const tier of product.pricing_tiers) {
        if (quantity >= tier.min_quantity) {
          if (tier.max_quantity === null || quantity <= tier.max_quantity) {
            unitPrice = tier.price_per_unit;
            break;
          }
        }
      }
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].unit_price = unitPrice;

    await cart.save();

    res.json({ message: 'Cart updated' });
  } catch (error) {
    console.error('Update salesman cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove from cart
router.delete('/cart/:retailer_id/remove/:product_id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const { retailer_id, product_id } = req.params;

    const cart = await SalesmanCart.findOne({
      salesman_id: req.user.userId,
      retailer_id: retailer_id
    });

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cart.items = cart.items.filter(
      item => item.product_id.toString() !== product_id
    );

    await cart.save();

    res.json({ message: 'Product removed from cart' });
  } catch (error) {
    console.error('Remove from salesman cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear cart for retailer
router.delete('/cart/:retailer_id/clear', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    await SalesmanCart.findOneAndDelete({
      salesman_id: req.user.userId,
      retailer_id: req.params.retailer_id
    });

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear salesman cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Place order for retailer
router.post('/place-order/:retailer_id', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    if (!salesman.permissions?.can_place_orders) {
      return res.status(403).json({ error: 'You do not have permission to place orders' });
    }

    const { delivery_address, notes } = req.body;
    const retailer_id = req.params.retailer_id;

    // Verify retailer is connected
    const connection = await Connection.findOne({
      wholesaler_id: salesman.wholesaler_id,
      retailer_id: retailer_id,
      status: 'approved'
    });

    if (!connection) {
      return res.status(400).json({ error: 'Retailer is not connected to your wholesaler' });
    }

    // Get retailer for address
    const retailer = await Retailer.findById(retailer_id);
    if (!retailer) {
      return res.status(404).json({ error: 'Retailer not found' });
    }

    // Get cart
    const cart = await SalesmanCart.findOne({
      salesman_id: req.user.userId,
      retailer_id: retailer_id
    }).populate('items.product_id');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Calculate order totals
    let subtotal = 0;
    let gst_amount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product_id;
      
      // Verify stock is still available
      if (item.quantity > product.stock_quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}` 
        });
      }

      const itemSubtotal = item.quantity * item.unit_price;
      const itemGst = (itemSubtotal * product.gst_percentage) / 100;
      const itemTotal = itemSubtotal + itemGst;

      orderItems.push({
        product_id: product._id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_amount: itemGst,
        total_price: itemTotal
      });

      subtotal += itemSubtotal;
      gst_amount += itemGst;
    }

    // Generate order number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    const todayOrdersCount = await Order.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    const sequence = (todayOrdersCount + 1).toString().padStart(4, '0');
    const orderNumber = `ORD${year}${month}${day}${sequence}`;

    // Create order
    const order = new Order({
      order_number: orderNumber,
      retailer_id: retailer_id,
      wholesaler_id: salesman.wholesaler_id,
      placed_by_salesman: req.user.userId,
      items: orderItems,
      subtotal: subtotal,
      gst_amount: gst_amount,
      total_amount: subtotal + gst_amount,
      delivery_address: delivery_address || retailer.business_address,
      notes: notes ? `[Order placed by Salesman: ${salesman.name}] ${notes}` : `[Order placed by Salesman: ${salesman.name}]`
    });

    await order.save();

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product_id._id,
        { $inc: { stock_quantity: -item.quantity } }
      );
    }

    // Clear cart
    await SalesmanCart.findByIdAndDelete(cart._id);

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        _id: order._id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        retailer_name: retailer.business_name
      }
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get orders placed by this salesman
router.get('/my-orders', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const orders = await Order.find({ placed_by_salesman: req.user.userId })
      .populate('retailer_id', 'business_name city phone')
      .populate('wholesaler_id', 'business_name')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Get salesman orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
