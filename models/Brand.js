const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// Compound index to ensure unique brand names per wholesaler
brandSchema.index({ wholesaler_id: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Brand', brandSchema);
