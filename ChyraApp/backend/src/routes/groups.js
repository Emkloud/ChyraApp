const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all user's groups
router.get('/', groupController.getUserGroups);

// Create group
router.post('/', groupController.createGroup);

// Get group details
router.get('/:groupId', groupController.getGroupById);

// Update group info (admin only)
router.put('/:groupId', groupController.updateGroup);

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
router.delete('/:groupId/messages/:messageId', groupController.deleteMessage);

// Settings
router.patch('/:groupId/settings', groupController.updateSettings);

// ✅ NEW: Subgroup routes
router.post('/:groupId/subgroups', groupController.createSubgroup);
router.get('/:groupId/subgroups', groupController.getSubgroups);
router.delete('/:groupId/subgroups/:subgroupId', groupController.deleteSubgroup);

module.exports = router;