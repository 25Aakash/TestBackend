const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { verifyToken, isWholesaler } = require('../middleware/auth');

// Get all categories (default + custom)
router.get('/', verifyToken, async (req, res) => {
  try {
    const categories = await Category.find().sort({ is_default: -1, name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new category (wholesaler only)
router.post('/', verifyToken, isWholesaler, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Check if category already exists (case-insensitive)
    const existing = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });

    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const category = new Category({
      name: name.trim(),
      created_by: req.user.userId,
      is_default: false
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Add category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
