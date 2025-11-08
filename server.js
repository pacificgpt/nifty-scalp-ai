require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const { processImage } = require('./utils/imageProcessor');
const { getScalpSignal } = require('./utils/scalper');

const app = express();
const upload = multer({ dest: process.env.UPLOAD_PATH });

app.use(express.static('public'));
app.use('/outputs', express.static('outputs'));

app.post('/api/scalp', upload.single('chart'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const imagePath = req.file.path;
    const outputPath = path.join(process.env.OUTPUT_PATH, `annotated_${req.file.filename}.png`);

    // Step 1: Extract price levels from chart
    const levels = await processImage(imagePath, outputPath);

    // Step 2: Generate scalp signal
    const signal = getScalpSignal(levels);

    res.json({
      success: true,
      signal,
      annotatedChart: `/outputs/annotated_${req.file.filename}.png`,
      original: req.file.originalname
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Nifty Scalp AI running on http://localhost:${PORT}`);
});
