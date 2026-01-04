const express = require('express');
const bcrypt = require('bcryptjs');
const Wholesaler = require('../models/Wholesaler');
const Retailer = require('../models/Retailer');
const Connection = require('../models/Connection');
const { verifyToken, isWholesaler } = require('../middleware/auth');

const router = express.Router();

// Get all wholesalers (public - for retailers)
router.get('/', async (req, res) => {
  try {
    const { city, state, business_type, search } = req.query;
    
    let query = { is_verified: true };
    
    if (city) {
      query.city = new RegExp(city, 'i');
    }
    
    if (state) {
      query.state = state;
    }
    
    if (business_type) {
      query.business_type = business_type;
    }
    
    if (search) {
      query.$or = [
        { business_name: new RegExp(search, 'i') },
        { owner_name: new RegExp(search, 'i') }
      ];
    }
    
    const wholesalers = await Wholesaler.find(query)
      .select('-password')
      .sort({ business_name: 1 });
    
    res.json(wholesalers);
  } catch (error) {
    console.error('Get wholesalers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get wholesaler by ID
router.get('/:id', async (req, res) => {
  try {
    const wholesaler = await Wholesaler.findById(req.params.id)
      .select('-password');
    
    if (!wholesaler) {
      return res.status(404).json({ error: 'Wholesaler not found' });
    }
    
    res.json(wholesaler);
  } catch (error) {
    console.error('Get wholesaler error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wholesaler: Add/Create new retailer (auto-connected)
router.post('/add-retailer', verifyToken, isWholesaler, async (req, res) => {
  try {
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
      pincode
    } = req.body;

    // Validation
    if (!business_name || !owner_name || !email || !phone || !password || !gst_number) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Check if email already exists
    const existingEmail = await Retailer.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if phone already exists
    const existingPhone = await Retailer.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Check if GST number already exists
    const existingGST = await Retailer.findOne({ gst_number: gst_number.toUpperCase() });
    if (existingGST) {
      return res.status(400).json({ error: 'GST number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create retailer
    const retailer = new Retailer({
      business_name,
      owner_name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      gst_number: gst_number.toUpperCase(),
      business_address,
      city,
      state,
      pincode,
      is_verified: true // Auto-verify since added by wholesaler
    });

    await retailer.save();

    // Create approved connection automatically
    const connection = new Connection({
      wholesaler_id: req.user.userId,
      retailer_id: retailer._id,
      status: 'approved',
      requested_by: 'wholesaler',
      message: 'Retailer added by wholesaler'
    });

    await connection.save();

    res.status(201).json({
      message: 'Retailer added successfully and connected',
      retailer: {
        _id: retailer._id,
        business_name: retailer.business_name,
        owner_name: retailer.owner_name,
        email: retailer.email,
        phone: retailer.phone
      }
    });
  } catch (error) {
    console.error('Add retailer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
