const mongoose = require('mongoose');

// Counter schema for atomic order number generation
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/**
 * Generate a unique order number using atomic counter (race-condition safe)
 * Format: ORD + YYMMDD + 4-digit sequence (e.g., ORD2603030001)
 * @returns {Promise<string>} Unique order number
 */
const generateOrderNumber = async () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dateKey = `${year}${month}${day}`;

  // Atomic increment — no race condition
  const counter = await Counter.findByIdAndUpdate(
    `order_${dateKey}`,
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );

  const sequence = counter.sequence.toString().padStart(4, '0');
  return `ORD${dateKey}${sequence}`;
};

module.exports = { generateOrderNumber };
