const mongoose = require('mongoose');
require('dotenv').config();
const Category = require('../models/Category');

const defaultCategories = [
  'Electronics',
  'Clothing & Apparel',
  'Food & Beverages',
  'Home & Kitchen',
  'Health & Beauty',
  'Stationery & Office',
  'Toys & Games',
  'Sports & Fitness',
  'Automotive',
  'Other',
];

async function seedCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wholesale-marketplace');
    console.log('Connected to MongoDB');

    // Create a system user ID for default categories
    const systemUserId = new mongoose.Types.ObjectId('000000000000000000000000');

    for (const catName of defaultCategories) {
      const existing = await Category.findOne({ name: catName });
      if (!existing) {
        await Category.create({
          name: catName,
          created_by: systemUserId,
          is_default: true
        });
        console.log(`✓ Added: ${catName}`);
      } else {
        console.log(`- Exists: ${catName}`);
      }
    }

    console.log('\n✅ Categories seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();
