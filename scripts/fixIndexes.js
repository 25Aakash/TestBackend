const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Fix Wholesaler indexes
    const wholesalersCollection = db.collection('wholesalers');
    
    try {
      await wholesalersCollection.dropIndex('gst_number_1');
      console.log('Dropped old gst_number index from wholesalers');
    } catch (error) {
      if (error.code === 27) {
        console.log('gst_number index does not exist in wholesalers (already dropped)');
      } else {
        throw error;
      }
    }

    try {
      await wholesalersCollection.dropIndex('email_1');
      console.log('Dropped old email index from wholesalers');
    } catch (error) {
      if (error.code === 27) {
        console.log('email index does not exist in wholesalers (already dropped)');
      } else {
        throw error;
      }
    }

    // Create new sparse indexes
    await wholesalersCollection.createIndex({ gst_number: 1 }, { unique: true, sparse: true });
    console.log('Created sparse gst_number index for wholesalers');

    await wholesalersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('Created sparse email index for wholesalers');

    // Fix Retailer indexes
    const retailersCollection = db.collection('retailers');
    
    try {
      await retailersCollection.dropIndex('gst_number_1');
      console.log('Dropped old gst_number index from retailers');
    } catch (error) {
      if (error.code === 27) {
        console.log('gst_number index does not exist in retailers (already dropped)');
      } else {
        throw error;
      }
    }

    try {
      await retailersCollection.dropIndex('email_1');
      console.log('Dropped old email index from retailers');
    } catch (error) {
      if (error.code === 27) {
        console.log('email index does not exist in retailers (already dropped)');
      } else {
        throw error;
      }
    }

    // Create new sparse indexes
    await retailersCollection.createIndex({ gst_number: 1 }, { unique: true, sparse: true });
    console.log('Created sparse gst_number index for retailers');

    await retailersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    console.log('Created sparse email index for retailers');

    console.log('\n✅ All indexes fixed successfully!');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixIndexes();
