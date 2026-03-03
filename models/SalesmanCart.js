const mongoose = require('mongoose');

const salesmanCartSchema = new mongoose.Schema({
  salesman_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salesman',
    required: true
  },
  retailer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: true
  },
  wholesaler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wholesaler',
    required: true
  },
  items: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unit_price: {
      type: Number,
      required: true
    }
  }],
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

salesmanCartSchema.index({ salesman_id: 1, retailer_id: 1 }, { unique: true });

module.exports = mongoose.model('SalesmanCart', salesmanCartSchema);
