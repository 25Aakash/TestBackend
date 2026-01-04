const mongoose = require('mongoose');

const wholesalerSchema = new mongoose.Schema({
  business_name: {
    type: String,
    required: true,
    trim: true
  },
  owner_name: {
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
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  gst_number: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  business_address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true
  },
  is_verified: {
    type: Boolean,
    default: false
  },
  minimum_order_value: {
    type: Number,
    default: 0
  },
  payment_terms: {
    type: String,
    enum: ['immediate', 'net_30', 'net_60', 'net_90'],
    default: 'immediate'
  }
}, { timestamps: true });

module.exports = mongoose.model('Wholesaler', wholesalerSchema);
