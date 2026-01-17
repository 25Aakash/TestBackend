require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Brand = require('../models/Brand');

const migrateBrands = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all unique brand names with their wholesaler IDs
    const products = await Product.find({ brand: { $exists: true, $ne: '' } })
      .select('brand wholesaler_id')
      .lean();

    console.log(`📦 Found ${products.length} products with brands`);

    // Group by wholesaler and collect unique brands
    const wholesalerBrands = {};
    products.forEach(product => {
      const wholesalerId = product.wholesaler_id.toString();
      if (!wholesalerBrands[wholesalerId]) {
        wholesalerBrands[wholesalerId] = new Set();
      }
      if (product.brand && product.brand.trim()) {
        wholesalerBrands[wholesalerId].add(product.brand.trim());
      }
    });

    console.log(`👥 Found brands for ${Object.keys(wholesalerBrands).length} wholesalers`);

    let totalCreated = 0;
    let totalSkipped = 0;

    // Create Brand documents for each wholesaler's brands
    for (const [wholesalerId, brandNames] of Object.entries(wholesalerBrands)) {
      console.log(`\n🏢 Processing wholesaler: ${wholesalerId}`);
      console.log(`   Brands found: ${Array.from(brandNames).join(', ')}`);

      for (const brandName of brandNames) {
        // Check if brand already exists
        const existingBrand = await Brand.findOne({
          wholesaler_id: wholesalerId,
          name: brandName
        });

        if (existingBrand) {
          console.log(`   ⏭️  Skipped: "${brandName}" (already exists)`);
          totalSkipped++;
        } else {
          // Create new brand
          const newBrand = new Brand({
            wholesaler_id: wholesalerId,
            name: brandName,
            description: ''
          });
          await newBrand.save();
          console.log(`   ✅ Created: "${brandName}"`);
          totalCreated++;
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Migration completed!`);
    console.log(`   Created: ${totalCreated} brands`);
    console.log(`   Skipped: ${totalSkipped} brands (already existed)`);
    console.log('='.repeat(50));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

migrateBrands();
