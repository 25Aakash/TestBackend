const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');
const Salesman = require('../models/Salesman');
const { verifyToken, isWholesaler, isWholesalerOrSalesman } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get all brands for the logged-in wholesaler/salesman
router.get('/', verifyToken, isWholesalerOrSalesman, async (req, res) => {
  try {
    const brands = await Brand.find({ wholesaler_id: req.effectiveWholesalerId })
      .sort({ name: 1 });

    res.json(brands);
  } catch (error) {
    logger.error('Get brands error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new brand
router.post('/', verifyToken, isWholesalerOrSalesman, async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    // Check if brand already exists for this wholesaler
    const existingBrand = await Brand.findOne({
      wholesaler_id: req.effectiveWholesalerId,
      name: name.trim()
    });

    if (existingBrand) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }

    const brand = new Brand({
      wholesaler_id: req.effectiveWholesalerId,
      name: name.trim(),
      description: description || '',
      image: image || ''
    });

    await brand.save();
    res.status(201).json(brand);
  } catch (error) {
    logger.error('Create brand error', { error: error.message, stack: error.stack });
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a brand
router.put('/:id', verifyToken, isWholesalerOrSalesman, async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const brand = await Brand.findOne({
      _id: req.params.id,
      wholesaler_id: req.effectiveWholesalerId
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check if new name conflicts with existing brand
    if (name.trim() !== brand.name) {
      const existingBrand = await Brand.findOne({
        wholesaler_id: req.effectiveWholesalerId,
        name: name.trim(),
        _id: { $ne: req.params.id }
      });

      if (existingBrand) {
        return res.status(400).json({ error: 'Brand name already exists' });
      }
    }

    brand.name = name.trim();
    brand.description = description || '';
    if (image !== undefined) {
      brand.image = image;
    }
    await brand.save();

    res.json(brand);
  } catch (error) {
    logger.error('Update brand error', { error: error.message, stack: error.stack });
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a brand (wholesaler only - salesmen cannot delete)
router.delete('/:id', verifyToken, isWholesaler, async (req, res) => {
  try {
    const brand = await Brand.findOneAndDelete({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    logger.error('Delete brand error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
