const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  product_name: String,
  quantity: {
    type: Number,
    required: true
  },
  unit_price: {
    type: Number,
    required: true
  },
  gst_amount: {
    type: Number,
    default: 0
  },
  total_price: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  order_number: {
    type: String,
    unique: true,
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
  placed_by_salesman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salesman',
    default: null
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  gst_amount: {
    type: Number,
    required: true
  },
  total_amount: {
    type: Number,
    required: true
  },
  delivery_address: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  payment_status: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  payment_terms: {
    type: String,
    enum: ['immediate', 'net_30', 'net_60', 'net_90'],
    default: 'immediate'
  },
  payment_due_date: {
    type: Date
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.order_number) {
    const count = await mongoose.model('Order').countDocuments();
    this.order_number = `ORD${Date.now()}${count + 1}`;
  }
  next();
});

// Index for faster queries
orderSchema.index({ retailer_id: 1 });
orderSchema.index({ wholesaler_id: 1 });
orderSchema.index({ order_number: 1 });

module.exports = mongoose.model('Order', orderSchema);
