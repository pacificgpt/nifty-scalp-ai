const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const { extractTextFromImage } = require('./ocr');
const { createPriceMapper } = require('./priceMapper');

/**
 * Process a chart image: extract price levels, detect latest candle,
 * map to prices, annotate the image, and return trading levels.
 */
async function processImage(inputPath, outputPath) {
  const image = await Jimp.read(inputPath);
  const { width, height } = image.bitmap;

  // === STEP 1: Extract price axis (right 15%) ===
  const axisX = Math.floor(width * 0.85);
  const axisWidth = width - axisX;
  const priceAxis = image.clone().crop(axisX, 0, axisWidth, height);
  const axisBuffer = await priceAxis.getBufferAsync(Jimp.MIME_PNG);

  const rawText = await extractTextFromImage(axisBuffer);
  const priceTicks = extractPriceLabels(rawText);

  if (priceTicks.length < 2) {
    throw new Error(
      `Could not detect enough price levels on Y-axis (found ${priceTicks.length}). ` +
      'Please ensure the chart image has a visible price axis with numeric labels.'
    );
  }

  const { toPrice, toY } = createPriceMapper(height, priceTicks);

  // === STEP 2: Detect latest candle (rightmost 10%) ===
  const chartEndX = Math.floor(width * 0.9);
  const chartBody = image.clone().crop(0, 0, chartEndX, height);
  const candle = detectLatestCandle(chartBody, chartEndX);

  // Guard: make sure candle has valid Y values
  if (candle.highY >= candle.lowY || candle.closeY < 0 || candle.closeY > height) {
    console.warn('[imageProcessor] Candle detection may be inaccurate:', candle);
  }

  // === STEP 3: Map to price ===
  const closePrice = toPrice(candle.closeY);
  const levels = {
    high: toPrice(candle.highY),
    low: toPrice(candle.lowY),
    close: closePrice,
    support: findNearestSupport(priceTicks, closePrice),
    resistance: findNearestResistance(priceTicks, closePrice),
    timestamp: new Date().toISOString(),
  };

  // === STEP 4: Annotate ===
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await annotateImage(image, levels, toY, outputPath);

  // Attach mapper for external use
  levels._mapper = { toPrice, toY };

  return levels;
}

/**
 * Extract numeric price labels from OCR text.
 * Matches 4-5 digit numbers optionally followed by a decimal.
 */
function extractPriceLabels(text) {
  const matches = text.match(/\d{4,5}(?:\.\d)?/g);
  if (!matches) return [];

  const prices = matches
    .map(parseFloat)
    .filter((n) => n > 5000 && n < 50000);

  // Deduplicate and sort
  return [...new Set(prices)].sort((a, b) => a - b);
}

/**
 * Simple candle detection: scan a column near the right edge for
 * green/red pixel runs to find the candle body.
 */
function detectLatestCandle(chartBody, chartEndX) {
  const w = chartBody.bitmap.width;
  const h = chartBody.bitmap.height;
  const scanX = Math.min(Math.floor(w * 0.92), w - 1);

  let highY = h;
  let lowY = 0;
  let bodyTop = h;
  let bodyBottom = 0;
  let inCandle = false;

  for (let y = 0; y < h; y++) {
    const idx = scanX * 4 + y * w * 4;

    // Bounds check
    if (idx + 3 >= chartBody.bitmap.data.length) break;

    const r = chartBody.bitmap.data[idx];
    const g = chartBody.bitmap.data[idx + 1];
    const b = chartBody.bitmap.data[idx + 2];

    const isGreen = g > r && g > b && g > 100;
    const isRed = r > g && r > b && r > 100;
    const isBody = isGreen || isRed;

    if (isBody && !inCandle) {
      inCandle = true;
      bodyTop = y;
    } else if (!isBody && inCandle) {
      bodyBottom = y;
      break;
    }

    if (isBody || r + g + b < 300) {
      highY = Math.min(highY, y);
      lowY = Math.max(lowY, y);
    }
  }

  // Fallback: if nothing detected, use the middle of the image
  if (highY >= lowY) {
    highY = Math.floor(h * 0.4);
    lowY = Math.floor(h * 0.6);
    bodyTop = highY;
    bodyBottom = lowY;
  }

  const closeY =
    bodyTop < bodyBottom * 0.3
      ? bodyTop
      : bodyBottom > 0
        ? bodyBottom
        : (highY + lowY) / 2;

  return { highY, lowY, closeY };
}

/**
 * Find the nearest support level (highest price tick below current price).
 * Returns null if no support level found.
 */
function findNearestSupport(ticks, price) {
  const below = ticks.filter((p) => p < price * 1.005);
  return below.length > 0 ? Math.max(...below) : null;
}

/**
 * Find the nearest resistance level (lowest price tick above current price).
 * Returns null if no resistance level found.
 */
function findNearestResistance(ticks, price) {
  const above = ticks.filter((p) => p > price * 0.995);
  return above.length > 0 ? Math.min(...above) : null;
}

/**
 * Draw horizontal lines on the image for Entry, SL, and TP levels.
 */
async function annotateImage(image, levels, toY, outputPath) {
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const green = 0x00ff00ff;
  const red = 0xff0000ff;
  const white = 0xffffffff;
  const imgWidth = image.bitmap.width;
  const imgHeight = image.bitmap.height;

  const drawHLine = (y, color, label) => {
    if (y == null || isNaN(y)) return;
    const iy = Math.round(y);

    // Skip if y is out of image bounds
    if (iy < 0 || iy >= imgHeight) return;

    const startX = Math.max(50, 0);
    const endX = Math.min(imgWidth - 50, imgWidth);

    for (let x = startX; x < endX; x++) {
      const idx = x * 4 + iy * imgWidth * 4;
      if (idx + 3 >= image.bitmap.data.length) continue;
      image.bitmap.data[idx] = (color >> 24) & 255;
      image.bitmap.data[idx + 1] = (color >> 16) & 255;
      image.bitmap.data[idx + 2] = (color >> 8) & 255;
      image.bitmap.data[idx + 3] = 255;
    }

    const labelY = Math.max(0, Math.min(iy - 10, imgHeight - 20));
    image.print(font, 60, labelY, label, 300);
  };

  const entryY = toY(levels.close);
  const slY = toY(levels.close * 0.997);
  const tpY = toY(levels.close * 1.006);

  drawHLine(entryY, green, `ENTRY: ${levels.close.toFixed(0)}`);
  drawHLine(slY, red, `SL: ${(levels.close * 0.997).toFixed(0)}`);
  drawHLine(tpY, white, `TP: ${(levels.close * 1.006).toFixed(0)}`);

  await image.writeAsync(outputPath);
}

module.exports = { processImage };
