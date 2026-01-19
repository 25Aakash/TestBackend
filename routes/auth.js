const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Wholesaler = require('../models/Wholesaler');
const Retailer = require('../models/Retailer');
const { verifyGST } = require('../services/gstService');

const router = express.Router();

// Generate JWT token
const generateToken = (userId, userType) => {
  return jwt.sign(
    { userId, userType },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Generate unique code from business name
const generateUniqueCode = async (businessName) => {
  // Extract initials from business name
  const words = businessName.trim().split(/\s+/);
  let baseCode = '';
  
  if (words.length === 1) {
    // Single word: take first 2-3 characters
    baseCode = words[0].substring(0, 3).toUpperCase();
  } else {
    // Multiple words: take first letter of each word (up to 4)
    baseCode = words
      .slice(0, 4)
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  }
  
  // Ensure minimum 2 characters
  if (baseCode.length < 2) {
    baseCode = businessName.substring(0, 2).toUpperCase();
  }
  
  // Check if code exists, if so add number suffix
  let uniqueCode = baseCode;
  let counter = 1;
  
  while (await Wholesaler.findOne({ unique_code: uniqueCode })) {
    uniqueCode = `${baseCode}${counter}`;
    counter++;
  }
  
  return uniqueCode;
};

// Wholesaler Signup
router.post('/wholesaler/signup', async (req, res) => {
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
      pincode,
      business_type
    } = req.body;

    // Normalize GST number - convert empty string to undefined
    const normalizedGstNumber = gst_number && gst_number.trim() ? gst_number.trim() : undefined;
    const normalizedEmail = email && email.trim() ? email.trim() : undefined;

    // Check if email or phone already exists
    const existingChecks = [{ phone }];
    if (normalizedEmail) {
      existingChecks.push({ email: normalizedEmail });
    }
    if (normalizedGstNumber) {
      existingChecks.push({ gst_number: normalizedGstNumber });
    }
    
    const existingWholesaler = await Wholesaler.findOne({
      $or: existingChecks
    });

    if (existingWholesaler) {
      return res.status(400).json({ error: 'Email, phone, or GST number already registered' });
    }

    // Verify GST (optional - can be done async)
    // const gstValid = await verifyGST(normalizedGstNumber);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique code for this wholesaler
    const uniqueCode = await generateUniqueCode(business_name);

    // Create wholesaler
    const wholesaler = new Wholesaler({
      business_name,
      unique_code: uniqueCode,
      owner_name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      gst_number: normalizedGstNumber,
      business_address,
      city,
      state,
      pincode,
      business_type: business_type || 'wholesaler'
    });

    await wholesaler.save();

    // Generate token
    const token = generateToken(wholesaler._id, 'wholesaler');

    res.status(201).json({
      message: 'Wholesaler registered successfully',
      token,
      user: {
        _id: wholesaler._id,
        business_name: wholesaler.business_name,
        unique_code: wholesaler.unique_code,
        email: wholesaler.email,
        userType: 'wholesaler'
      }
    });
  } catch (error) {
    console.error('Wholesaler signup error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Retailer Signup
router.post('/retailer/signup', async (req, res) => {
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

    // Normalize GST number - convert empty string to undefined
    const normalizedGstNumber = gst_number && gst_number.trim() ? gst_number.trim() : undefined;
    const normalizedEmail = email && email.trim() ? email.trim() : undefined;

    // Check if email or phone already exists
    const existingChecks = [{ phone }];
    if (normalizedEmail) {
      existingChecks.push({ email: normalizedEmail });
    }
    if (normalizedGstNumber) {
      existingChecks.push({ gst_number: normalizedGstNumber });
    }
    
    const existingRetailer = await Retailer.findOne({
      $or: existingChecks
    });

    if (existingRetailer) {
      return res.status(400).json({ error: 'Email, phone, or GST number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create retailer
    const retailer = new Retailer({
      business_name,
      owner_name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      gst_number: normalizedGstNumber,
      business_address,
      city,
      state,
      pincode
    });

    await retailer.save();

    // Generate token
    const token = generateToken(retailer._id, 'retailer');

    res.status(201).json({
      message: 'Retailer registered successfully',
      token,
      user: {
        _id: retailer._id,
        business_name: retailer.business_name,
        email: retailer.email,
        userType: 'retailer'
      }
    });
  } catch (error) {
    console.error('Retailer signup error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login (handles both wholesaler and retailer)
router.post('/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    if (!email || !password || !userType) {
      return res.status(400).json({ error: 'Email/Phone, password, and user type are required' });
    }

    let user;
    // Check if input is email or phone number
    const isPhone = /^\d{10}$/.test(email); // Check if it's a 10-digit phone number
    
    if (userType === 'wholesaler') {
      if (isPhone) {
        user = await Wholesaler.findOne({ phone: email });
      } else {
        user = await Wholesaler.findOne({ email });
      }
    } else if (userType === 'retailer') {
      if (isPhone) {
        user = await Retailer.findOne({ phone: email });
      } else {
        user = await Retailer.findOne({ email });
      }
    } else {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id, userType);

    // Build user response
    const userResponse = {
      _id: user._id,
      business_name: user.business_name,
      owner_name: user.owner_name,
      email: user.email,
      phone: user.phone,
      gst_number: user.gst_number,
      userType
    };

    // Add unique_code for wholesalers
    if (userType === 'wholesaler' && user.unique_code) {
      userResponse.unique_code = user.unique_code;
    }

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
