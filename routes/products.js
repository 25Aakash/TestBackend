const express = require('express');
const Product = require('../models/Product');
const Connection = require('../models/Connection');
const { verifyToken, isWholesaler, isRetailer } = require('../middleware/auth');

const router = express.Router();

// Get all products (filtered by connections for retailers)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, wholesaler_id, search } = req.query;
    
    let query = { is_active: true };
    
    // If user is a retailer, only show products from connected wholesalers
    if (req.user.userType === 'retailer') {
      const connections = await Connection.find({
        retailer_id: req.user.userId,
        status: 'approved'
      }).select('wholesaler_id');
      
      const connectedWholesalerIds = connections.map(c => c.wholesaler_id);
      
      if (connectedWholesalerIds.length === 0) {
        // No connections, return empty array
        return res.json([]);
      }
      
      query.wholesaler_id = { $in: connectedWholesalerIds };
    }
    
    if (category) {
      query.category = category;
    }
    
    if (wholesaler_id) {
      query.wholesaler_id = wholesaler_id;
    }
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const products = await Product.find(query)
      .populate('wholesaler_id', 'business_name city state')
      .sort({ createdAt: -1 });
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('wholesaler_id', 'business_name owner_name phone email business_address city state');
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get wholesaler's products (requires wholesaler auth)
router.get('/my/products', verifyToken, isWholesaler, async (req, res) => {
  try {
    const products = await Product.find({ wholesaler_id: req.user.userId })
      .sort({ createdAt: -1 });
    
    res.json(products);
  } catch (error) {
    console.error('Get my products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (wholesaler only)
router.post('/', verifyToken, isWholesaler, async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      subcategory,
      brand,
      sku,
      unit_type,
      moq,
      stock_quantity,
      pricing_tiers,
      base_price,
      mrp,
      gst_percentage,
      hsn_code,
      image_url,
      images
    } = req.body;

    // Validate pricing tiers
    if (!pricing_tiers || pricing_tiers.length === 0) {
      return res.status(400).json({ error: 'At least one pricing tier is required' });
    }

    const product = new Product({
      wholesaler_id: req.user.userId,
      name,
      description,
      category,
      subcategory,
      brand,
      sku,
      unit_type,
      moq: moq || 1,
      stock_quantity: stock_quantity || 0,
      pricing_tiers,
      base_price,
      mrp,
      gst_percentage: gst_percentage || 18,
      hsn_code,
      image_url,
      images: images || []
    });

    await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product (wholesaler only)
router.put('/:id', verifyToken, isWholesaler, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update fields
    const allowedUpdates = [
      'name', 'description', 'category', 'subcategory', 'brand', 'sku',
      'unit_type', 'moq', 'stock_quantity', 'pricing_tiers', 'base_price',
      'mrp', 'gst_percentage', 'hsn_code', 'image_url', 'images', 'is_active'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product (wholesaler only)
router.delete('/:id', verifyToken, isWholesaler, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      wholesaler_id: req.user.userId
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get price for quantity (calculate based on tiers)
router.post('/:id/calculate-price', async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (quantity < product.moq) {
      return res.status(400).json({ 
        error: `Minimum order quantity is ${product.moq}` 
      });
    }

    // Find applicable pricing tier
    let unitPrice = product.base_price;
    for (const tier of product.pricing_tiers) {
      if (quantity >= tier.min_quantity) {
        if (tier.max_quantity === null || quantity <= tier.max_quantity) {
          unitPrice = tier.price_per_unit;
          break;
        }
      }
    }

    const subtotal = unitPrice * quantity;
    const gstAmount = (subtotal * product.gst_percentage) / 100;
    const total = subtotal + gstAmount;

    res.json({
      unit_price: unitPrice,
      quantity,
      subtotal,
      gst_percentage: product.gst_percentage,
      gst_amount: gstAmount,
      total
    });
  } catch (error) {
    console.error('Calculate price error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
