const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
const path = require('path');
const { protect } = require('../middleware/auth');

// Configure AWS SDK v2
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const BUCKET = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;

if (!BUCKET) {
  console.warn('Upload route: S3_BUCKET is not set.');
}

const allowedMimePrefixes = ['image/', 'video/', 'audio/'];
const allowedExact = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

const fileFilter = (req, file, cb) => {
  const type = file.mimetype || '';
  if (allowedMimePrefixes.some(p => type.startsWith(p)) || allowedExact.has(type)) {
    return cb(null, true);
  }
  return cb(new Error('Unsupported file type'), false);
};

const storage = multerS3({
  s3,
  bucket: BUCKET,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const userId = (req.user && req.user.id) || 'anonymous';
    const ts = Date.now();
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const key = `uploads/${userId}/${ts}_${base}${ext}`;
    cb(null, key);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { location, key, etag, size, mimetype, originalname } = req.file;
    
    let messageType = 'file';
    if (mimetype.startsWith('image/')) messageType = 'image';
    else if (mimetype.startsWith('video/')) messageType = 'video';
    else if (mimetype.startsWith('audio/')) messageType = 'audio';

    return res.status(201).json({
      success: true,
      data: {
        url: location,
        filename: originalname,
        size,
        mimeType: mimetype,
        type: messageType,
        key,
        etag
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

module.exports = router;