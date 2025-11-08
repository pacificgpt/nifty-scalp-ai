const { createWorker } = require('tesseract.js');

let worker = null;

async function initOCR() {
  if (worker) return worker;
  worker = createWorker({
    logger: m => console.log('[OCR]', m.status, Math.round(m.progress * 100) + '%')
  });
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  console.log('OCR Engine Ready');
  return worker;
}

async function extractTextFromImage(buffer) {
  const ocr = await initOCR();
  const { data: { text } } = await ocr.recognize(buffer);
  return text;
}

module.exports = { extractTextFromImage };
