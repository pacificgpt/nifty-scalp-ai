require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processImage } = require('./utils/imageProcessor');
const { getScalpSignal } = require('./utils/scalper');
const { terminateOCR } = require('./utils/ocr');

const app = express();

// ---------------------------------------------------------------------------
// Directory setup — ensure upload and output dirs exist
// ---------------------------------------------------------------------------
const UPLOAD_PATH = process.env.UPLOAD_PATH || 'uploads';
const OUTPUT_PATH = process.env.OUTPUT_PATH || 'outputs';

fs.mkdirSync(UPLOAD_PATH, { recursive: true });
fs.mkdirSync(OUTPUT_PATH, { recursive: true });

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static('public'));
app.use('/outputs', express.static(OUTPUT_PATH));

// Multer config — 10 MB limit, images only
const upload = multer({
  dest: UPLOAD_PATH,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Health check */
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/** Scalp signal from chart image */
app.post('/api/scalp', upload.single('chart'), async (req, res) => {
  let tempFile = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempFile = req.file.path;
    const outputPath = path.join(
      OUTPUT_PATH,
      `annotated_${req.file.filename}.png`
    );

    // Step 1: Extract price levels from chart
    const levels = await processImage(tempFile, outputPath);

    // Step 2: Generate scalp signal
    const signal = getScalpSignal(levels);

    res.json({
      success: true,
      signal,
      annotatedChart: `/outputs/annotated_${req.file.filename}.png`,
      original: req.file.originalname,
    });
  } catch (err) {
    console.error('[/api/scalp] Error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Clean up the uploaded temp file
    if (tempFile) {
      fs.unlink(tempFile, (unlinkErr) => {
        if (unlinkErr) console.error('Failed to clean up temp file:', unlinkErr.message);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Multer error handler (catches file-too-large, invalid type, etc.)
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Nifty Scalp AI running on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  await terminateOCR();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
