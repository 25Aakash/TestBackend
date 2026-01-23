// Migration script to add default permissions to existing salesmen
require('dotenv').config();
const mongoose = require('mongoose');
const Salesman = require('../models/Salesman');

const MONGODB_URI = process.env.MONGODB_URI;

const defaultPermissions = {
  can_add_products: true,
  can_delete_products: false,
  can_add_brands: true,
  can_add_retailers: true,
  can_delete_retailers: false,
  can_view_all_retailers: true,
  can_place_orders: true
};

async function migrateSalesmenPermissions() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all salesmen without permissions field or with incomplete permissions
    const salesmen = await Salesman.find({
      $or: [
        { permissions: { $exists: false } },
        { permissions: null }
      ]
    });

    console.log(`Found ${salesmen.length} salesmen without permissions`);

    if (salesmen.length === 0) {
      console.log('All salesmen already have permissions set!');
      await mongoose.disconnect();
      return;
    }

    // Update each salesman with default permissions
    for (const salesman of salesmen) {
      salesman.permissions = defaultPermissions;
      await salesman.save();
      console.log(`✓ Updated permissions for: ${salesman.name} (${salesman.phone})`);
    }

    console.log(`\n✅ Successfully migrated ${salesmen.length} salesmen with default permissions`);
    console.log('\nDefault permissions applied:');
    console.log('  - Add Products: ON');
    console.log('  - Delete Products: OFF');
    console.log('  - Add Brands: ON');
    console.log('  - Add Retailers: ON');
    console.log('  - Delete Retailers: OFF');
    console.log('  - View All Retailers: ON');
    console.log('  - Place Orders: ON');

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateSalesmenPermissions();
