const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Check if AWS S3 is configured
 */
const isS3Configured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
};

/**
 * Generate unique filename
 */
const generateFileName = (originalname) => {
  const ext = path.extname(originalname);
  const name = path.basename(originalname, ext);
  const timestamp = Date.now();
  const uniqueId = uuidv4().split('-')[0];
  return `${name}-${timestamp}-${uniqueId}${ext}`;
};

/**
 * Multer configuration for S3
 */
const upload = multer({
  storage: isS3Configured() ? multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const folder = file.fieldname || 'uploads';
      const fileName = generateFileName(file.originalname);
      cb(null, `${folder}/${fileName}`);
    }
  }) : multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, generateFileName(file.originalname));
    }
  }),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [];
    
    if (allowedTypes.length === 0 || allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

/**
 * Upload single file
 */
const uploadSingle = (fieldName) => {
  return upload.single(fieldName);
};

/**
 * Upload multiple files
 */
const uploadMultiple = (fieldName, maxCount = 10) => {
  return upload.array(fieldName, maxCount);
};

/**
 * Upload file directly to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - File name
 * @param {String} contentType - MIME type
 * @param {String} folder - S3 folder
 */
const uploadToS3 = async (fileBuffer, fileName, contentType, folder = 'uploads') => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured');
  }

  const key = `${folder}/${generateFileName(fileName)}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    ACL: 'public-read'
  };

  try {
    const result = await s3.upload(params).promise();
    return {
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
};

/**
 * Delete file from S3
 * @param {String} fileKey - S3 object key
 */
const deleteFromS3 = async (fileKey) => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured');
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey
  };

  try {
    await s3.deleteObject(params).promise();
    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3');
  }
};

/**
 * Get signed URL for private files
 * @param {String} fileKey - S3 object key
 * @param {Number} expiresIn - URL expiration time in seconds
 */
const getSignedUrl = (fileKey, expiresIn = 3600) => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured');
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey,
    Expires: expiresIn
  };

  return s3.getSignedUrl('getObject', params);
};

/**
 * List files in S3 folder
 * @param {String} folder - S3 folder path
 */
const listFiles = async (folder = '') => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured');
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Prefix: folder
  };

  try {
    const result = await s3.listObjectsV2(params).promise();
    return result.Contents.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`
    }));
  } catch (error) {
    console.error('S3 list error:', error);
    throw new Error('Failed to list files from S3');
  }
};

/**
 * Copy file within S3
 * @param {String} sourceKey - Source S3 object key
 * @param {String} destinationKey - Destination S3 object key
 */
const copyFile = async (sourceKey, destinationKey) => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured');
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    CopySource: `${process.env.AWS_S3_BUCKET}/${sourceKey}`,
    Key: destinationKey
  };

  try {
    await s3.copyObject(params).promise();
    return {
      success: true,
      url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${destinationKey}`
    };
  } catch (error) {
    console.error('S3 copy error:', error);
    throw new Error('Failed to copy file in S3');
  }
};

/**
 * Get file metadata
 * @param {String} fileKey - S3 object key
 */
const getFileMetadata = async (fileKey) => {
  if (!isS3Configured()) {
    throw new Error('AWS S3 is not configured');
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey
  };

  try {
    const result = await s3.headObject(params).promise();
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      lastModified: result.LastModified,
      metadata: result.Metadata
    };
  } catch (error) {
    console.error('S3 metadata error:', error);
    throw new Error('Failed to get file metadata from S3');
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadToS3,
  deleteFromS3,
  getSignedUrl,
  listFiles,
  copyFile,
  getFileMetadata,
  isS3Configured
};