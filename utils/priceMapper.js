/**
 * Creates a function that maps pixel Y (0 = top, height = bottom) → price
 * @param {number} height - Canvas height in pixels
 * @param {number[]} priceTicks - Array of detected price labels
 * @returns {Object} { toPrice(y), toY(price) }
 */
function createPriceMapper(height, priceTicks) {
  if (!priceTicks || priceTicks.length < 2) {
    throw new Error('Need at least 2 price ticks to map');
  }

  // Sort and dedupe
  const sorted = [...new Set(priceTicks)].sort((a, b) => a - b);
  const minPrice = sorted[0];
  const maxPrice = sorted[sorted.length - 1];

  const priceRange = maxPrice - minPrice;
  const pixelRange = height;

  const toPrice = (y) => {
    const ratio = 1 - (y / pixelRange); // invert Y
    return minPrice + ratio * priceRange;
  };

  const toY = (price) => {
    const ratio = (price - minPrice) / priceRange;
    return pixelRange * (1 - ratio);
  };

  return { toPrice, toY, minPrice, maxPrice };
}

module.exports = { createPriceMapper };
