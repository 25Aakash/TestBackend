/**
 * Calculate unit price based on quantity and pricing tiers
 * @param {object} product - Product with base_price and pricing_tiers
 * @param {number} quantity - The quantity to calculate price for
 * @returns {number} The unit price for the given quantity
 */
const calculateUnitPrice = (product, quantity) => {
  let unitPrice = product.base_price;

  if (product.pricing_tiers && product.pricing_tiers.length > 0) {
    for (const tier of product.pricing_tiers) {
      if (quantity >= tier.min_quantity) {
        if (tier.max_quantity === null || quantity <= tier.max_quantity) {
          unitPrice = tier.price_per_unit;
          break;
        }
      }
    }
  }

  return unitPrice;
};

/**
 * Calculate full price breakdown for a product at a given quantity
 * @param {object} product - Product with base_price, pricing_tiers, gst_percentage
 * @param {number} quantity - The quantity to calculate price for
 * @returns {object} { unitPrice, subtotal, gstAmount, total }
 */
const calculatePriceBreakdown = (product, quantity) => {
  const unitPrice = calculateUnitPrice(product, quantity);
  const subtotal = unitPrice * quantity;
  const gstAmount = (subtotal * product.gst_percentage) / 100;
  const total = subtotal + gstAmount;

  return { unitPrice, subtotal, gstAmount, total };
};

module.exports = { calculateUnitPrice, calculatePriceBreakdown };
