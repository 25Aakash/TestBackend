const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Wholesaler = require('../models/Wholesaler');
const Retailer = require('../models/Retailer');
const Salesman = require('../models/Salesman');
const { verifyGST } = require('../services/gstService');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, registerSchema, loginSchema } = require('../validators/schemas');
const logger = require('../utils/logger');

const router = express.Router();

// Generate JWT token
const generateToken = (userId, userType) => {
  return jwt.sign(
    { userId, userType },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Wholesaler Signup
router.post('/wholesaler/signup', authLimiter, async (req, res) => {
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create wholesaler
    const wholesaler = new Wholesaler({
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
        email: wholesaler.email,
        userType: 'wholesaler'
      }
    });
  } catch (error) {
    logger.error('Wholesaler signup error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Retailer Signup
router.post('/retailer/signup', authLimiter, async (req, res) => {
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
    logger.error('Retailer signup error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login (handles both wholesaler and retailer)
router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password, userType } = req.validatedData || req.body;

    let user;
    // Check if input is email or phone number
    const isPhone = /^\d{10}$/.test(email);
    
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
    } else if (userType === 'salesman') {
      if (isPhone) {
        user = await Salesman.findOne({ phone: email, is_active: true });
      } else {
        user = await Salesman.findOne({ email, is_active: true });
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

    // Check if user needs to set password (for users added by wholesaler/salesman)
    if (user.requires_password_setup) {
      const tempToken = jwt.sign(
        { userId: user._id, userType, purpose: 'password_setup' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return res.json({
        requiresPasswordSetup: true,
        tempToken,
        userType,
        message: 'Please set your password to continue'
      });
    }

    // Generate token
    const token = generateToken(user._id, userType);

    // Build response based on user type
    let userResponse = {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      userType
    };

    if (userType === 'salesman') {
      userResponse.name = user.name;
      userResponse.wholesaler_id = user.wholesaler_id;
    } else {
      userResponse.business_name = user.business_name;
      userResponse.owner_name = user.owner_name;
      userResponse.gst_number = user.gst_number;
    }

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    logger.error('Login error', { error: error.message, email: req.body.email });
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Set password (for users who need to set their password on first login)
router.post('/set-password', async (req, res) => {
  try {
    const { tempToken, newPassword } = req.body;

    if (!tempToken || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify the temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
    }

    if (decoded.purpose !== 'password_setup') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const { userId, userType } = decoded;

    // Find the user
    let user;
    if (userType === 'retailer') {
      user = await Retailer.findById(userId);
    } else if (userType === 'salesman') {
      user = await Salesman.findById(userId);
    } else {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.requires_password_setup) {
      return res.status(400).json({ error: 'Password already set' });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.requires_password_setup = false;
    await user.save();

    // Generate regular token
    const token = generateToken(user._id, userType);

    // Build response based on user type
    let userResponse = {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      userType
    };

    if (userType === 'salesman') {
      userResponse.name = user.name;
      userResponse.wholesaler_id = user.wholesaler_id;
    } else {
      userResponse.business_name = user.business_name;
      userResponse.owner_name = user.owner_name;
      userResponse.gst_number = user.gst_number;
    }

    res.json({
      message: 'Password set successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    logger.error('Set password error', { error: error.message });
    res.status(500).json({ error: 'Server error while setting password' });
  }
});

// Unified Login — auto-detect user type from credentials
router.post('/unified-login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email/phone and password are required' });
    }

    const isPhone = /^\d{10}$/.test(email.trim());
    const searchField = isPhone ? 'phone' : 'email';
    const searchValue = isPhone ? email.trim() : email.trim().toLowerCase();

    // Search across all user collections in priority order
    let user = null;
    let userType = null;

    // 1. Try Wholesaler
    const wholesaler = await Wholesaler.findOne({ [searchField]: searchValue });
    if (wholesaler) {
      user = wholesaler;
      userType = 'wholesaler';
    }

    // 2. Try Retailer
    if (!user) {
      const retailer = await Retailer.findOne({ [searchField]: searchValue });
      if (retailer) {
        user = retailer;
        userType = 'retailer';
      }
    }

    // 3. Try Salesman
    if (!user) {
      const salesman = await Salesman.findOne({ [searchField]: searchValue, is_active: true });
      if (salesman) {
        user = salesman;
        userType = 'salesman';
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user needs to set password
    if (user.requires_password_setup) {
      const tempToken = jwt.sign(
        { userId: user._id, userType, purpose: 'password_setup' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return res.json({
        requiresPasswordSetup: true,
        tempToken,
        userType,
        message: 'Please set your password to continue'
      });
    }

    // Generate token
    const token = generateToken(user._id, userType);

    // Build response
    let userResponse = {
      _id: user._id,
      email: user.email,
      phone: user.phone,
      userType
    };

    if (userType === 'salesman') {
      userResponse.name = user.name;
      userResponse.wholesaler_id = user.wholesaler_id;
    } else {
      userResponse.business_name = user.business_name;
      userResponse.owner_name = user.owner_name;
      userResponse.gst_number = user.gst_number;
    }

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    logger.error('Unified login error', { error: error.message });
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;

