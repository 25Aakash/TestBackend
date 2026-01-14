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
      phone_alt1,
      phone_alt2,
      password,
      gst_number,
      business_address,
      city,
      state,
      pincode
    } = req.body;

    // Validation (email is now optional)
    if (!business_name || !owner_name || !phone || !password) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Normalize email and GST - convert empty strings to undefined
    const normalizedEmail = email && email.trim() ? email.trim().toLowerCase() : undefined;
    const normalizedGstNumber = gst_number && gst_number.trim() ? gst_number.trim().toUpperCase() : undefined;

    // Check if email already exists (only if email is provided)
    if (normalizedEmail) {
      const existingEmail = await Retailer.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    // Check if phone already exists
    const existingPhone = await Retailer.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Check if GST number already exists (only if GST is provided)
    if (normalizedGstNumber) {
      const existingGST = await Retailer.findOne({ gst_number: normalizedGstNumber });
      if (existingGST) {
        return res.status(400).json({ error: 'GST number already registered' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create retailer
    const retailer = new Retailer({
      business_name,
      owner_name,
      email: normalizedEmail,
      phone,
      phone_alt1: phone_alt1 || '',
      phone_alt2: phone_alt2 || '',
      password: hashedPassword,
      gst_number: normalizedGstNumber,
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
