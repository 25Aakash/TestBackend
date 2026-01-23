const mongoose = require('mongoose');

const salesmanSchema = new mongoose.Schema({
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
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  requires_password_setup: {
    type: Boolean,
    default: false
  },
  is_active: {
    type: Boolean,
    default: true
  },
  // Salesman permissions - what they can do
  permissions: {
    can_add_products: {
      type: Boolean,
      default: true
    },
    can_delete_products: {
      type: Boolean,
      default: false  // Default to false - only wholesaler can delete by default
    },
    can_add_brands: {
      type: Boolean,
      default: true
    },
    can_add_retailers: {
      type: Boolean,
      default: true
    },
    can_delete_retailers: {
      type: Boolean,
      default: false  // Default to false - only wholesaler can delete by default
    },
    can_view_all_retailers: {
      type: Boolean,
      default: true  // Can see retailers added by wholesaler
    },
    can_place_orders: {
      type: Boolean,
      default: true
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
salesmanSchema.index({ wholesaler_id: 1 });
salesmanSchema.index({ email: 1 });

module.exports = mongoose.model('Salesman', salesmanSchema);
