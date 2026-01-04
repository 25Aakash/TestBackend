const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
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
}, { _id: false });

const cartSchema = new mongoose.Schema({
  retailer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Update timestamp on save
cartSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Cart', cartSchema);
