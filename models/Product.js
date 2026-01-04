const mongoose = require('mongoose');

const priceTierSchema = new mongoose.Schema({
  min_quantity: {
    type: Number,
    required: true
  },
  max_quantity: {
    type: Number,
    default: null // null means no upper limit
  },
  price_per_unit: {
    type: Number,
    required: true
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
  wholesaler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wholesaler',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String,
    default: ''
  },
  brand: {
    type: String,
    default: ''
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  unit_type: {
    type: String,
    enum: ['piece', 'box', 'carton', 'kg', 'liter', 'meter'],
    default: 'piece'
  },
  moq: {
    type: Number,
    required: true,
    default: 1
  },
  stock_quantity: {
    type: Number,
    required: true,
    default: 0
  },
  pricing_tiers: {
    type: [priceTierSchema],
    validate: {
      validator: function(tiers) {
        return tiers && tiers.length > 0;
      },
      message: 'At least one pricing tier is required'
    }
  },
  base_price: {
    type: Number,
    required: true
  },
  mrp: {
    type: Number,
    default: 0
  },
  gst_percentage: {
    type: Number,
    default: 18
  },
  hsn_code: {
    type: String,
    default: ''
  },
  image_url: {
    type: String,
    default: ''
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Index for faster queries
productSchema.index({ wholesaler_id: 1 });
productSchema.index({ category: 1 });
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
