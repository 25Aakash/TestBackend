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

    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }

    // Check if email or phone already exists
    const existingSalesman = await Salesman.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingSalesman) {
      return res.status(400).json({ error: 'Email or phone already registered' });
    }

    // Use phone as temporary password - they will set their own on first login
    const hashedPassword = await bcrypt.hash(phone, 10);

    const salesman = new Salesman({
      wholesaler_id: req.user.userId,
      name,
      email: email.toLowerCase().trim(),
      phone,
      password: hashedPassword,
      requires_password_setup: true
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

    const { name, email, phone, password, is_active } = req.body;

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
        is_active: salesman.is_active
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

// Get retailers added by this salesman
router.get('/my-retailers', verifyToken, async (req, res) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Only salesmen can access this' });
    }

    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman) {
      return res.status(404).json({ error: 'Salesman not found' });
    }

    const connections = await Connection.find({
      wholesaler_id: salesman.wholesaler_id,
      salesman_id: req.user.userId
    }).populate('retailer_id', 'business_name owner_name phone city state');

    const retailers = connections.map(conn => ({
      _id: conn.retailer_id._id,
      business_name: conn.retailer_id.business_name,
      owner_name: conn.retailer_id.owner_name,
      phone: conn.retailer_id.phone,
      city: conn.retailer_id.city,
      state: conn.retailer_id.state,
      status: conn.status,
      connection_id: conn._id
    }));

    res.json(retailers);
  } catch (error) {
    console.error('Get my retailers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
