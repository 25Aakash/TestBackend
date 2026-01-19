const jwt = require('jsonwebtoken');
const Wholesaler = require('../models/Wholesaler');
const Retailer = require('../models/Retailer');
const Salesman = require('../models/Salesman');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Check if user is wholesaler
const isWholesaler = async (req, res, next) => {
  try {
    if (req.user.userType !== 'wholesaler') {
      return res.status(403).json({ error: 'Access denied. Wholesaler access required.' });
    }
    
    const wholesaler = await Wholesaler.findById(req.user.userId);
    if (!wholesaler) {
      return res.status(404).json({ error: 'Wholesaler not found' });
    }
    
    req.wholesaler = wholesaler;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Check if user is wholesaler or salesman (for product management)
const isWholesalerOrSalesman = async (req, res, next) => {
  try {
    if (req.user.userType === 'wholesaler') {
      const wholesaler = await Wholesaler.findById(req.user.userId);
      if (!wholesaler) {
        return res.status(404).json({ error: 'Wholesaler not found' });
      }
      req.wholesaler = wholesaler;
      req.effectiveWholesalerId = wholesaler._id;
      next();
    } else if (req.user.userType === 'salesman') {
      const salesman = await Salesman.findById(req.user.userId);
      if (!salesman || !salesman.is_active) {
        return res.status(404).json({ error: 'Salesman not found or inactive' });
      }
      req.salesman = salesman;
      req.effectiveWholesalerId = salesman.wholesaler_id;
      next();
    } else {
      return res.status(403).json({ error: 'Access denied. Wholesaler or Salesman access required.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Check if user is retailer
const isRetailer = async (req, res, next) => {
  try {
    if (req.user.userType !== 'retailer') {
      return res.status(403).json({ error: 'Access denied. Retailer access required.' });
    }
    
    const retailer = await Retailer.findById(req.user.userId);
    if (!retailer) {
      return res.status(404).json({ error: 'Retailer not found' });
    }
    
    req.retailer = retailer;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Check if user is salesman
const isSalesman = async (req, res, next) => {
  try {
    if (req.user.userType !== 'salesman') {
      return res.status(403).json({ error: 'Access denied. Salesman access required.' });
    }
    
    const salesman = await Salesman.findById(req.user.userId);
    if (!salesman || !salesman.is_active) {
      return res.status(404).json({ error: 'Salesman not found or inactive' });
    }
    
    req.salesman = salesman;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { verifyToken, isWholesaler, isWholesalerOrSalesman, isRetailer, isSalesman };
