const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  wholesaler_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wholesaler',
    required: true
  },
  retailer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Retailer',
    required: true
  },
  salesman_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salesman',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requested_by: {
    type: String,
    enum: ['retailer', 'wholesaler', 'salesman'],
    required: true
  },
  message: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Compound index to ensure unique connections
connectionSchema.index({ wholesaler_id: 1, retailer_id: 1 }, { unique: true });

// Index for faster queries
connectionSchema.index({ wholesaler_id: 1, status: 1 });
connectionSchema.index({ retailer_id: 1, status: 1 });

module.exports = mongoose.model('Connection', connectionSchema);
