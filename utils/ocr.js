const { createWorker } = require('tesseract.js');

let worker = null;

/**
 * Initialize OCR worker using Tesseract.js v5 API.
 * createWorker() in v5 is async and returns a fully initialized worker.
 */
async function initOCR() {
  if (worker) return worker;

  worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log('[OCR]', m.status, Math.round(m.progress * 100) + '%');
      }
    },
  });

  console.log('OCR Engine Ready');
  return worker;
}

/**
 * Extract text from an image buffer using Tesseract OCR.
 * @param {Buffer} buffer - Image data as a Buffer
 * @returns {Promise<string>} Recognized text
 */
async function extractTextFromImage(buffer) {
  const ocr = await initOCR();
  const {
    data: { text },
  } = await ocr.recognize(buffer);
  return text;
}

/**
 * Gracefully terminate the OCR worker.
 */
async function terminateOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
    console.log('OCR Engine Terminated');
  }
}

module.exports = { extractTextFromImage, terminateOCR };
