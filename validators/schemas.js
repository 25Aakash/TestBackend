const Joi = require('joi');

// Product validation schema
const productSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).allow('').optional(),
  category: Joi.string().required(),
  subcategory: Joi.string().allow('').optional(),
  brand: Joi.string().allow('').optional(),
  sku: Joi.string().allow('').optional(),
  unit_type: Joi.string().valid('piece', 'box', 'carton', 'kg', 'liter', 'meter').required(),
  moq: Joi.number().integer().min(1).default(1),
  stock_quantity: Joi.number().integer().min(0).default(0),
  base_price: Joi.number().positive().required(),
  mrp: Joi.number().positive().optional(),
  gst_percentage: Joi.number().min(0).max(100).default(18),
  hsn_code: Joi.string().allow('').optional(),
  image_url: Joi.string().uri().allow('').optional(),
  images: Joi.array().items(Joi.object({
    uri: Joi.string().required(),
    isPrimary: Joi.boolean().default(false)
  })).max(3).optional(),
  pricing_tiers: Joi.array().items(Joi.object({
    min_quantity: Joi.number().integer().min(1).required(),
    max_quantity: Joi.number().integer().min(1).allow(null).optional(),
    price_per_unit: Joi.number().positive().required()
  })).optional(),
  is_active: Joi.boolean().default(true),
});

// Order validation schema
const orderSchema = Joi.object({
  delivery_address: Joi.string().max(500).optional(),
  notes: Joi.string().max(500).allow('').optional(),
});

// User registration validation
const registerSchema = Joi.object({
  business_name: Joi.string().min(3).max(100).required(),
  owner_name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().allow('').optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  password: Joi.string().min(6).required(),
  gst_number: Joi.string().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).allow('').optional(),
  business_address: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  pincode: Joi.string().pattern(/^[0-9]{6}$/).required(),
});

// Login validation
const loginSchema = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
  userType: Joi.string().valid('retailer', 'wholesaler', 'salesman').required(),
});

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    req.validatedData = value;
    next();
  };
};

module.exports = {
  validate,
  productSchema,
  orderSchema,
  registerSchema,
  loginSchema,
};
