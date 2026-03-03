const express = require('express');
const Product = require('../models/Product');
const Connection = require('../models/Connection');
const { verifyToken, isWholesalerOrSalesman } = require('../middleware/auth');
const { attachBrandDetails } = require('../utils/brandHelper');
const { calculateUnitPrice, calculatePriceBreakdown } = require('../utils/pricing');
const { validate, productSchema } = require('../validators/schemas');
const logger = require('../utils/logger');

const router = express.Router();

// Get all products (filtered by connections for retailers)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, wholesaler_id, search, page = 1, limit = 20 } = req.query;
    
    let query = { is_active: true };
    
    // If user is a retailer, only show products from connected wholesalers
    if (req.user.userType === 'retailer') {
      const connections = await Connection.find({
        retailer_id: req.user.userId,
        status: 'approved'
      }).select('wholesaler_id');
      
      const connectedWholesalerIds = connections.map(c => c.wholesaler_id);
      
      if (connectedWholesalerIds.length === 0) {
        return res.json({
          products: [],
          totalPages: 0,
          currentPage: parseInt(page),
          totalProducts: 0
        });
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
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Get total count
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limitNum);
    
    const products = await Product.find(query)
      .populate('wholesaler_id', 'business_name city state')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Attach brand details with images
    const productsWithBrands = await attachBrandDetails(products);
    
    res.json({
      products: productsWithBrands,
      totalPages,
      currentPage: pageNum,
      totalProducts
    });
  } catch (error) {
    logger.error('Get products error', { error: error.message, stack: error.stack });
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
    
    // Attach brand details if product has a brand
    const productWithBrand = await attachBrandDetails([product]);
    
    res.json(productWithBrand[0]);
  } catch (error) {
    logger.error('Get product error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// Get wholesaler's products (requires wholesaler or salesman auth)
router.get('/my/products', verifyToken, isWholesalerOrSalesman, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Get total count
    const totalProducts = await Product.countDocuments({ wholesaler_id: req.effectiveWholesalerId });
    const totalPages = Math.ceil(totalProducts / limitNum);
    
    const products = await Product.find({ wholesaler_id: req.effectiveWholesalerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    res.json({
      products,
      totalPages,
      currentPage: pageNum,
      totalProducts
    });
  } catch (error) {
    logger.error('Get my products error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (wholesaler or salesman)
router.post('/', verifyToken, isWholesalerOrSalesman, validate(productSchema), async (req, res) => {
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
    } = req.validatedData || req.body;

    const product = new Product({
      wholesaler_id: req.effectiveWholesalerId,
      name,
      description,
      category,
      subcategory,
      brand,
      sku,
      unit_type,
      moq: moq || 1,
      stock_quantity: stock_quantity || 0,
      pricing_tiers: pricing_tiers || [],
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
    logger.error('Create product error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product (wholesaler or salesman)
router.put('/:id', verifyToken, isWholesalerOrSalesman, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      wholesaler_id: req.effectiveWholesalerId
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
    logger.error('Update product error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product (wholesaler or salesman with permission)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    let wholesalerId;
    
    if (req.user.userType === 'wholesaler') {
      wholesalerId = req.user.userId;
    } else if (req.user.userType === 'salesman') {
      const Salesman = require('../models/Salesman');
      const salesman = await Salesman.findById(req.user.userId);
      
      if (!salesman) {
        return res.status(404).json({ error: 'Salesman not found' });
      }
      
      if (!salesman.permissions?.can_delete_products) {
        return res.status(403).json({ error: 'You do not have permission to delete products' });
      }
      
      wholesalerId = salesman.wholesaler_id;
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      wholesaler_id: wholesalerId
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('Delete product error', { error: error.message, stack: error.stack });
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

    const { unitPrice, subtotal, gstAmount, total } = calculatePriceBreakdown(product, quantity);

    res.json({
      unit_price: unitPrice,
      quantity,
      subtotal,
      gst_percentage: product.gst_percentage,
      gst_amount: gstAmount,
      total
    });
  } catch (error) {
    logger.error('Calculate price error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
