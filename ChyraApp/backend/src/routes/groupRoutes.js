const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Create group
router.post('/', groupController.createGroup);

// Get group details
router.get('/:groupId', groupController.getGroupDetails);

// Update group info (admin only)
router.patch('/:groupId', groupController.updateGroupInfo);

// Member management
router.post('/:groupId/members', groupController.addMembers);
router.delete('/:groupId/members/:memberId', groupController.removeMember);

// Admin management
router.post('/:groupId/admins/:memberId', groupController.makeAdmin);
router.delete('/:groupId/admins/:memberId', groupController.removeAdmin);

// Group actions
router.post('/:groupId/leave', groupController.leaveGroup);
router.delete('/:groupId', groupController.deleteGroup);

// Message management
router.delete('/:groupId/messages/:messageId', groupController.deleteGroupMessage);

// Settings
router.patch('/:groupId/settings', groupController.updateGroupSettings);

module.exports = router;