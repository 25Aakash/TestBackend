const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');
const { verifyToken } = require('../middleware/auth');

// Get all brands for the logged-in wholesaler
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can access brands' });
    }

    const brands = await Brand.find({ wholesaler_id: req.user.userId })
      .sort({ name: 1 });

    res.json(brands);
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new brand
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can create brands' });
    }

    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    // Check if brand already exists for this wholesaler
    const existingBrand = await Brand.findOne({
      wholesaler_id: req.user.userId,
      name: name.trim()
    });

    if (existingBrand) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }

    const brand = new Brand({
      wholesaler_id: req.user.userId,
      name: name.trim(),
      description: description || ''
    });

    await brand.save();
    res.status(201).json(brand);
  } catch (error) {
    console.error('Create brand error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a brand
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can update brands' });
    }

    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const brand = await Brand.findOne({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check if new name conflicts with existing brand
    if (name.trim() !== brand.name) {
      const existingBrand = await Brand.findOne({
        wholesaler_id: req.user.userId,
        name: name.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingBrand) {
        return res.status(400).json({ error: 'Brand name already exists' });
      }
    }

    brand.name = name.trim();
    brand.description = description || '';
    await brand.save();

    res.json(brand);
  } catch (error) {
    console.error('Update brand error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a brand
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'wholesaler') {
      return res.status(403).json({ error: 'Only wholesalers can delete brands' });
    }

    const brand = await Brand.findOneAndDelete({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
