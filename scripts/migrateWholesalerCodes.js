/**
 * Migration script to generate unique codes for existing wholesalers
 * Run this once after deploying the unique_code feature
 * 
 * Usage: node scripts/migrateWholesalerCodes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Wholesaler = require('../models/Wholesaler');

// Generate unique code from business name
const generateUniqueCode = async (businessName, existingCodes) => {
  // Extract initials from business name
  const words = businessName.trim().split(/\s+/);
  let baseCode = '';
  
  if (words.length === 1) {
    // Single word: take first 2-3 characters
    baseCode = words[0].substring(0, 3).toUpperCase();
  } else {
    // Multiple words: take first letter of each word (up to 4)
    baseCode = words
      .slice(0, 4)
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  }
  
  // Ensure minimum 2 characters
  if (baseCode.length < 2) {
    baseCode = businessName.substring(0, 2).toUpperCase();
  }
  
  // Check if code exists in our set, if so add number suffix
  let uniqueCode = baseCode;
  let counter = 1;
  
  while (existingCodes.has(uniqueCode)) {
    uniqueCode = `${baseCode}${counter}`;
    counter++;
  }
  
  return uniqueCode;
};

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all wholesalers without unique_code
    const wholesalers = await Wholesaler.find({
      $or: [
        { unique_code: { $exists: false } },
        { unique_code: null },
        { unique_code: '' }
      ]
    });

    console.log(`Found ${wholesalers.length} wholesalers without unique codes`);

    if (wholesalers.length === 0) {
      console.log('No migration needed');
      await mongoose.disconnect();
      return;
    }

    // Get existing codes to avoid duplicates
    const existingWholesalers = await Wholesaler.find({ unique_code: { $exists: true, $ne: null, $ne: '' } });
    const existingCodes = new Set(existingWholesalers.map(w => w.unique_code));

    console.log(`Existing codes: ${existingCodes.size}`);

    // Generate and update codes
    for (const wholesaler of wholesalers) {
      const uniqueCode = await generateUniqueCode(wholesaler.business_name, existingCodes);
      existingCodes.add(uniqueCode); // Add to set to prevent duplicates in this batch

      await Wholesaler.updateOne(
        { _id: wholesaler._id },
        { $set: { unique_code: uniqueCode } }
      );

      console.log(`✓ ${wholesaler.business_name} -> ${uniqueCode}`);
    }

    console.log('\nMigration completed successfully!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
