const AWS = require('aws-sdk');
const crypto = require('crypto');
const mime = require('mime');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET;

if (!BUCKET) {
  console.warn('S3: S3_BUCKET is not set. Presigned uploads will be disabled.');
}

// Configure AWS SDK v2
AWS.config.update({ region: REGION });
const s3 = new AWS.S3();

const generateObjectKey = ({ userId, extension = 'jpg' }) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  return `profiles/${userId}/profile_${ts}_${rand}.${extension}`;
};

const getPresignedPutUrl = async ({ key, contentType, expiresIn = 60 }) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
    Expires: expiresIn
  };
  
  const url = await s3.getSignedUrlPromise('putObject', params);
  return url;
};

const publicUrlForKey = ({ key, region = REGION, bucket = BUCKET }) => {
  // Virtual-hosted–style URL
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
};

const inferExtensionFromMime = (contentType) => {
  const ext = mime.getExtension(contentType || '') || 'jpg';
  return ext;
};

module.exports = {
  s3,
  BUCKET,
  REGION,
  generateObjectKey,
  getPresignedPutUrl,
  publicUrlForKey,
  inferExtensionFromMime,
};