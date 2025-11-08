const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const { extractTextFromImage } = require('./ocr');
const { createPriceMapper } = require('./priceMapper');

async function processImage(inputPath, outputPath) {
  const image = await Jimp.read(inputPath);
  const { width, height } = image.bitmap;

  // === STEP 1: Extract price axis (right 15%) ===
  const axisX = width * 0.85;
  const priceAxis = image.clone().crop(axisX, 0, width - axisX, height);
  const axisBuffer = await priceAxis.getBufferAsync(Jimp.MIME_PNG);

  const rawText = await extractTextFromImage(axisBuffer);
  const priceTicks = extractPriceLabels(rawText);

  if (priceTicks.length < 2) {
    throw new Error('Could not detect enough price levels on Y-axis');
  }

  const { toPrice, toY } = createPriceMapper(height, priceTicks);

  // === STEP 2: Detect latest candle (rightmost 10%) ===
  const chartBody = image.clone().crop(0, 0, width * 0.9, height);
  const candle = await detectLatestCandle(chartBody, width * 0.9);

  // === STEP 3: Map to price ===
  const levels = {
    high: toPrice(candle.highY),
    low: toPrice(candle.lowY),
    close: toPrice(candle.closeY),
    support: findNearestSupport(priceTicks, toPrice(candle.closeY)),
    resistance: findNearestResistance(priceTicks, toPrice(candle.closeY)),
    timestamp: new Date().toISOString()
  };

  // === STEP 4: Annotate ===
  await annotateImage(image, levels, toY, outputPath);

  // Attach mapper for external use
  levels._mapper = { toPrice, toY };

  return levels;
}

// Extract numbers like 24300, 24350, etc.
function extractPriceLabels(text) {
  const matches = text.match(/\d{4,5}(?:\.\d)?/g);
  return matches ? matches.map(parseFloat).filter(n => n > 5000 && n < 50000) : [];
}

// Simple candle detection: rightmost column with color changes
async function detectLatestCandle(chartBody, chartEndX) {
  const w = chartBody.bitmap.width;
  const h = chartBody.bitmap.height;
  const scanX = Math.floor(w * 0.92); // near right edge

  let highY = h, lowY = 0, bodyTop = h, bodyBottom = 0;
  let inCandle = false;

  for (let y = 0; y < h; y++) {
    const idx = (scanX * 4) + (y * w * 4);
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

  const closeY = bodyTop < bodyBottom * 0.3 ? bodyTop : bodyBottom;

  return { highY, lowY, closeY: closeY || (highY + lowY) / 2 };
}

function findNearestSupport(ticks, price) {
  return Math.max(...ticks.filter(p => p < price * 1.005));
}

function findNearestResistance(ticks, price) {
  return Math.min(...ticks.filter(p => p > price * 0.995));
}

async function annotateImage(image, levels, toY, outputPath) {
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const green = 0x00ff00ff;
  const red = 0xff0000ff;
  const white = 0xffffffff;

  const drawHLine = (y, color, label) => {
    if (!y || isNaN(y)) return;
    const iy = Math.round(y);
    for (let x = 50; x < image.bitmap.width - 50; x++) {
      const idx = (x * 4) + (iy * image.bitmap.width * 4);
      image.bitmap.data[idx] = (color >> 24) & 255;
      image.bitmap.data[idx + 1] = (color >> 16) & 255;
      image.bitmap.data[idx + 2] = (color >> 8) & 255;
      image.bitmap.data[idx + 3] = 255;
    }
    image.print(font, 60, iy - 10, label, 300);
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
