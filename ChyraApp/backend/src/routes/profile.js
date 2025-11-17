const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const {
  generateObjectKey,
  getPresignedPutUrl,
  publicUrlForKey,
  inferExtensionFromMime,
  BUCKET
} = require('../services/s3');

// ============================================
// GET CURRENT USER'S PROFILE
// ============================================
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.getPublicProfile());
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// S3 FLOW: GET PRESIGNED URL FOR DIRECT UPLOAD
// ============================================
router.post('/upload-url', protect, async (req, res) => {
  try {
    const { contentType } = req.body || {};
    if (!contentType) {
      return res.status(400).json({ error: 'contentType is required' });
    }
    if (!BUCKET) {
      return res.status(500).json({ error: 'S3 not configured' });
    }
    const ext = inferExtensionFromMime(contentType);
    const key = generateObjectKey({ userId: req.user.id, extension: ext });
    const url = await getPresignedPutUrl({ key, contentType, expiresIn: 60 });
    return res.json({ url, key, contentType, bucket: BUCKET });
  } catch (error) {
    console.error('Presign upload error:', error);
    return res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

// ============================================
// S3 FLOW: CONFIRM UPLOAD AND SAVE PROFILE URL
// ============================================
router.post('/confirm', protect, async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    // Basic ownership check: key should include the user's id path
    if (!key.startsWith(`profiles/${req.user.id}/`)) {
      return res.status(400).json({ error: 'Invalid key for user' });
    }
    const user = await User.findById(req.user.id);
    const url = publicUrlForKey({ key });
    user.profilePicture = url;
    user.profilePicturePublicId = key; // reuse field to store S3 object key
    await user.save();
    return res.json({ message: 'Profile updated', profilePicture: url });
  } catch (error) {
    console.error('Confirm upload error:', error);
    return res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

// ============================================
// GET USER PROFILE BY ID
// ============================================
router.get('/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.getPublicProfile());
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// UPDATE PROFILE (bio, status, about)
// ============================================
router.put('/update', protect, async (req, res) => {
  try {
    const { bio, status, about } = req.body;

    const updateFields = {};
    if (bio !== undefined) updateFields.bio = bio;
    if (status !== undefined) updateFields.status = status;
    if (about !== undefined) updateFields.about = about;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// UPLOAD PROFILE PICTURE
// ============================================
router.post('/upload-picture', protect, async (req, res) => {
  try {
    return res.status(400).json({
      error: 'Direct uploads are disabled. Use /profile/upload-url to get a presigned S3 URL, upload directly to S3, then call /profile/confirm with the key.'
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// ============================================
// DELETE PROFILE PICTURE
// ============================================
router.delete('/delete-picture', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Even if there is no stored key, respond gracefully
    if (!user.profilePicture && !user.profilePicturePublicId) {
      return res.status(400).json({ error: 'No profile picture to delete' });
    }

    // Clear stored fields (S3 object cleanup can be handled asynchronously if desired)
    user.profilePicture = null;
    user.profilePicturePublicId = null;
    await user.save();

    res.json({ message: 'Profile picture deleted successfully' });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({ error: 'Failed to delete profile picture' });
  }
});

// ============================================
// SEARCH USERS
// ============================================
router.get('/search', protect, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.user.id }
    })
      .select('-password')
      .limit(20);

    res.json(users.map(user => user.getPublicProfile()));
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
