const mongoose = require('mongoose');

const retailerSchema = new mongoose.Schema({
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
    required: false,
    sparse: true,
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
  credit_limit: {
    type: Number,
    default: 0
  },
  outstanding_amount: {
    type: Number,
    default: 0
  },
  is_verified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Retailer', retailerSchema);
