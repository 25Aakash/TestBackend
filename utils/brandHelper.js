const Brand = require('../models/Brand');

/**
 * Attach brand details (image, description) to an array of products
 * @param {Array} products - Array of product documents (or plain objects)
 * @returns {Promise<Array>} Products with brandDetails attached
 */
const attachBrandDetails = async (products) => {
  const brandLookups = products
    .filter(p => p.brand && p.wholesaler_id)
    .map(p => ({
      wholesaler_id: p.wholesaler_id._id || p.wholesaler_id,
      brand: p.brand
    }));

  if (brandLookups.length === 0) return products;

  // Fetch all relevant brands in one query
  const brands = await Brand.find({
    $or: brandLookups.map(bl => ({
      wholesaler_id: bl.wholesaler_id,
      name: bl.brand
    }))
  });

  // Create a lookup map
  const brandMap = {};
  brands.forEach(b => {
    const key = `${b.wholesaler_id}_${b.name}`;
    brandMap[key] = {
      _id: b._id,
      name: b.name,
      image: b.image || '',
      description: b.description || ''
    };
  });

  // Attach brand details to products
  return products.map(p => {
    const productObj = p.toObject ? p.toObject() : p;
    const wholesalerId = productObj.wholesaler_id?._id || productObj.wholesaler_id;
    const key = `${wholesalerId}_${productObj.brand}`;
    if (brandMap[key]) {
      productObj.brandDetails = brandMap[key];
    }
    return productObj;
  });
};

module.exports = { attachBrandDetails };
