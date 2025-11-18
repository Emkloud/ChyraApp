const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get all user's groups
// @route   GET /api/groups
// @access  Private
exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    console.log('[GROUP] Getting groups for user:', userId);

    const groups = await Conversation.find({
      isGroup: true,
      'participants.user': userId,
      'participants.isActive': true
    })
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username fullName profilePicture' }
      })
      .populate('subgroups')
      .sort({ lastMessageAt: -1 });

    console.log('[GROUP] Found groups:', groups.length);

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('[GROUP] Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch groups',
      error: error.message
    });
  }
};

// @desc    Create a new group
// @route   POST /api/groups
// @access  Private
exports.createGroup = async (req, res) => {
  try {
    const { name, description, memberIds, groupPicture, avatar } = req.body;
    const creatorId = req.user.id || req.user._id;

    console.log('[GROUP] Creating group:', { name, memberIds: memberIds?.length, creatorId });

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    // Allow creating group with just the creator
    const memberIdsArray = memberIds || [];

    // Verify all members exist if any provided
    if (memberIdsArray.length > 0) {
      const members = await User.find({ _id: { $in: memberIdsArray } });
      if (members.length !== memberIdsArray.length) {
        return res.status(400).json({
          success: false,
          message: 'Some members not found'
        });
      }
    }

    // Create participants array (creator as admin + members)
    const participants = [
      {
        user: creatorId,
        role: 'admin',
        joinedAt: new Date(),
        isActive: true
      },
      ...memberIdsArray
        .filter(id => id.toString() !== creatorId.toString())
        .map(memberId => ({
          user: memberId,
          role: 'member',
          joinedAt: new Date(),
          isActive: true
        }))
    ];

    // Create group conversation
    const group = await Conversation.create({
      name: name.trim(),
      description: description?.trim() || '',
      groupPicture: groupPicture || avatar || '',
      avatar: avatar || '👥',
      isGroup: true,
      createdBy: creatorId,
      participants,
      settings: {
        onlyAdminsCanMessage: false,
        onlyAdminsCanAddMembers: false
      },
      lastMessageAt: new Date()
    });

    // Populate the group
    const populatedGroup = await Conversation.findById(group._id)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture');

    console.log('[GROUP] Group created:', populatedGroup._id);

    // Emit socket event to all members
    const io = req.app.get('io');
    if (io) {
      participants.forEach(p => {
        io.to(`user:${p.user}`).emit('group:created', populatedGroup);
      });
    }

    res.status(201).json({
      success: true,
      data: populatedGroup
    });
  } catch (error) {
    console.error('[GROUP] Create error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create group',
      error: error.message
    });
  }
};

// @desc    Get group by ID
// @route   GET /api/groups/:id
// @access  Private
exports.getGroupById = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;

    console.log('[GROUP] Getting group:', groupId);

    const group = await Conversation.findById(groupId)
      .populate('participants.user', 'username fullName profilePicture email lastSeen')
      .populate('createdBy', 'username fullName profilePicture')
      .populate({
        path: 'subgroups',
        populate: {
          path: 'participants.user',
          select: 'username fullName profilePicture'
        }
      })
      .populate('parentGroup', 'name');

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('[GROUP] Get group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group',
      error: error.message
    });
  }
};

// @desc    Update group info (admin only)
// @route   PUT /api/groups/:id
// @access  Private
exports.updateGroup = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;
    const { name, description, groupPicture, avatar } = req.body;

    console.log('[GROUP] Updating group:', { groupId, updates: { name, description } });

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    if (!group.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update group info'
      });
    }

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (groupPicture !== undefined) group.groupPicture = groupPicture;
    if (avatar !== undefined) group.avatar = avatar;

    await group.save();

    const updatedGroup = await Conversation.findById(groupId)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture');

    console.log('[GROUP] Group updated:', updatedGroup._id);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      group.participants.forEach(p => {
        if (p.isActive) {
          const participantId = p.user._id || p.user;
          io.to(`user:${participantId}`).emit('group:updated', updatedGroup);
        }
      });
    }

    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('[GROUP] Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update group',
      error: error.message
    });
  }
};

// @desc    Delete group (creator only)
// @route   DELETE /api/groups/:id
// @access  Private
exports.deleteGroup = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;

    console.log('[GROUP] Deleting group:', groupId);

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const creatorId = group.createdBy._id || group.createdBy;
    if (creatorId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can delete the group'
      });
    }

    // If this is a parent group, delete all subgroups
    if (!group.isSubgroup && group.subgroups && group.subgroups.length > 0) {
      for (const subgroupId of group.subgroups) {
        await Message.deleteMany({ conversation: subgroupId });
        await Conversation.findByIdAndDelete(subgroupId);
      }
    }

    // If this is a subgroup, remove from parent's subgroups array
    if (group.isSubgroup && group.parentGroup) {
      const parentGroup = await Conversation.findById(group.parentGroup);
      if (parentGroup) {
        parentGroup.removeSubgroup(groupId);
        await parentGroup.save();
      }
    }

    // Delete all messages in the group
    await Message.deleteMany({ conversation: groupId });

    // Delete the group
    await group.deleteOne();

    console.log('[GROUP] Group deleted:', groupId);

    // Emit socket event to all members
    const io = req.app.get('io');
    if (io) {
      group.participants.forEach(p => {
        const participantId = p.user._id || p.user;
        io.to(`user:${participantId}`).emit('group:deleted', { groupId });
      });
    }

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('[GROUP] Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete group',
      error: error.message
    });
  }
};

// @desc    Add members to group
// @route   POST /api/groups/:id/members
// @access  Private
exports.addMembers = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;
    const { memberIds } = req.body;

    console.log('[GROUP] Adding members:', { groupId, memberIds: memberIds?.length });

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Member IDs are required'
      });
    }

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Check if only admins can add members
    if (group.settings.onlyAdminsCanAddMembers && !group.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can add members'
      });
    }

    // Verify all members exist
    const members = await User.find({ _id: { $in: memberIds } });
    if (members.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some members not found'
      });
    }

    // Add members
    memberIds.forEach(memberId => {
      group.addMember(memberId, userId);
    });

    await group.save();

    const updatedGroup = await Conversation.findById(groupId)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture');

    console.log('[GROUP] Members added to group:', groupId);

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      memberIds.forEach(memberId => {
        io.to(`user:${memberId}`).emit('group:added', updatedGroup);
      });

      group.participants.forEach(p => {
        if (p.isActive) {
          const participantId = p.user._id || p.user;
          io.to(`user:${participantId}`).emit('group:updated', updatedGroup);
        }
      });
    }

    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('[GROUP] Add members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add members',
      error: error.message
    });
  }
};

// @desc    Remove member from group (admin or self)
// @route   DELETE /api/groups/:id/members/:memberId
// @access  Private
exports.removeMember = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;
    const memberId = req.params.memberId;

    console.log('[GROUP] Removing member:', { groupId, memberId });

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Can remove yourself or admin can remove others
    const isSelf = userId.toString() === memberId.toString();
    const isAdmin = group.isAdmin(userId);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can remove members'
      });
    }

    // Cannot remove the creator
    const creatorId = group.createdBy._id || group.createdBy;
    if (creatorId.toString() === memberId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove the group creator'
      });
    }

    group.removeMember(memberId);
    await group.save();

    const updatedGroup = await Conversation.findById(groupId)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture');

    console.log('[GROUP] Member removed from group:', groupId);

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${memberId}`).emit('group:removed', { groupId });

      group.participants.forEach(p => {
        if (p.isActive) {
          const participantId = p.user._id || p.user;
          io.to(`user:${participantId}`).emit('group:updated', updatedGroup);
        }
      });
    }

    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('[GROUP] Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      error: error.message
    });
  }
};

// @desc    Make member an admin
// @route   POST /api/groups/:id/admins/:memberId
// @access  Private (Admin only)
exports.makeAdmin = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;
    const memberId = req.params.memberId;

    console.log('[GROUP] Making admin:', { groupId, memberId });

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can promote members'
      });
    }

    if (!group.isMember(memberId)) {
      return res.status(404).json({
        success: false,
        message: 'User is not a member of this group'
      });
    }

    group.makeAdmin(memberId);
    await group.save();

    const updatedGroup = await Conversation.findById(groupId)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture');

    console.log('[GROUP] Member promoted to admin:', memberId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      group.participants.forEach(p => {
        if (p.isActive) {
          const participantId = p.user._id || p.user;
          io.to(`user:${participantId}`).emit('group:updated', updatedGroup);
        }
      });
    }

    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('[GROUP] Make admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to make admin',
      error: error.message
    });
  }
};

// @desc    Remove admin role
// @route   DELETE /api/groups/:id/admins/:memberId
// @access  Private (Admin only)
exports.removeAdmin = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;
    const memberId = req.params.memberId;

    console.log('[GROUP] Removing admin:', { groupId, memberId });

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can demote members'
      });
    }

    // Cannot demote the creator
    const creatorId = group.createdBy._id || group.createdBy;
    if (creatorId.toString() === memberId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot demote the group creator'
      });
    }

    group.removeAdmin(memberId);
    await group.save();

    const updatedGroup = await Conversation.findById(groupId)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture');

    console.log('[GROUP] Admin role removed:', memberId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      group.participants.forEach(p => {
        if (p.isActive) {
          const participantId = p.user._id || p.user;
          io.to(`user:${participantId}`).emit('group:updated', updatedGroup);
        }
      });
    }

    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('[GROUP] Remove admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove admin',
      error: error.message
    });
  }
};

// @desc    Update group settings (admin only)
// @route   PATCH /api/groups/:id/settings
// @access  Private
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;
    const { onlyAdminsCanMessage, onlyAdminsCanAddMembers } = req.body;

    console.log('[GROUP] Updating settings:', { groupId, settings: req.body });

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update settings'
      });
    }

    if (onlyAdminsCanMessage !== undefined) {
      group.settings.onlyAdminsCanMessage = onlyAdminsCanMessage;
    }
    if (onlyAdminsCanAddMembers !== undefined) {
      group.settings.onlyAdminsCanAddMembers = onlyAdminsCanAddMembers;
    }

    await group.save();

    const updatedGroup = await Conversation.findById(groupId)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture');

    console.log('[GROUP] Settings updated:', groupId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      group.participants.forEach(p => {
        if (p.isActive) {
          const participantId = p.user._id || p.user;
          io.to(`user:${participantId}`).emit('group:updated', updatedGroup);
        }
      });
    }

    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('[GROUP] Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
};

// @desc    Delete message in group (admin or sender)
// @route   DELETE /api/groups/:id/messages/:messageId
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const groupId = req.params.id;
    const messageId = req.params.messageId;

    console.log('[GROUP] Deleting message:', { groupId, messageId });

    const group = await Conversation.findById(groupId);

    if (!group || !group.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    const message = await Message.findById(messageId);

    if (!message || message.conversation.toString() !== groupId) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only admin or message sender can delete
    const isAdmin = group.isAdmin(userId);
    const senderId = message.sender._id || message.sender;
    const isSender = senderId.toString() === userId.toString();

    if (!isAdmin && !isSender) {
      return res.status(403).json({
        success: false,
        message: 'Only admins or the message sender can delete messages'
      });
    }

    await message.deleteOne();

    console.log('[GROUP] Message deleted:', messageId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      group.participants.forEach(p => {
        if (p.isActive) {
          const participantId = p.user._id || p.user;
          io.to(`user:${participantId}`).emit('message:deleted', {
            conversationId: groupId,
            messageId,
            deletedBy: userId
          });
        }
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('[GROUP] Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

// ==================== SUBGROUP METHODS ====================

// @desc    Create a subgroup
// @route   POST /api/groups/:id/subgroups
// @access  Private (Parent group admin only)
exports.createSubgroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { name, description, memberIds, avatar } = req.body;
    const userId = req.user.id || req.user._id;

    console.log('[SUBGROUP] Creating subgroup:', { groupId, name, memberIds: memberIds?.length });

    // Get parent group
    const parentGroup = await Conversation.findById(groupId);

    if (!parentGroup) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    // Check if user is admin of parent group
    if (!parentGroup.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only parent group admins can create subgroups'
      });
    }

    // Prevent creating subgroups of subgroups
    if (parentGroup.isSubgroup) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create subgroups of subgroups'
      });
    }

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subgroup name is required'
      });
    }

    // Validate members (must be subset of parent group members)
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one member is required for subgroup'
      });
    }

    // Verify all members are in parent group
    const parentMemberIds = parentGroup.participants
      .filter(p => p.isActive)
      .map(p => (p.user._id || p.user).toString());

    const invalidMembers = memberIds.filter(id => !parentMemberIds.includes(id.toString()));

    if (invalidMembers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All subgroup members must be members of the parent group'
      });
    }

    // Create participants array (creator as admin + selected members)
    const participants = [
      {
        user: userId,
        role: 'admin',
        joinedAt: new Date(),
        isActive: true
      },
      ...memberIds
        .filter(id => id.toString() !== userId.toString())
        .map(memberId => ({
          user: memberId,
          role: 'member',
          joinedAt: new Date(),
          isActive: true
        }))
    ];

    // Create subgroup
    const subgroup = await Conversation.create({
      name: name.trim(),
      description: description?.trim() || '',
      avatar: avatar || '👥',
      isGroup: true,
      isSubgroup: true,
      parentGroup: groupId,
      createdBy: userId,
      participants,
      settings: {
        onlyAdminsCanMessage: false,
        onlyAdminsCanAddMembers: false
      },
      lastMessageAt: new Date()
    });

    // Add subgroup to parent's subgroups array
    parentGroup.addSubgroup(subgroup._id);
    await parentGroup.save();

    // Populate the subgroup
    const populatedSubgroup = await Conversation.findById(subgroup._id)
      .populate('participants.user', 'username fullName profilePicture email')
      .populate('createdBy', 'username fullName profilePicture')
      .populate('parentGroup', 'name');

    console.log('[SUBGROUP] Subgroup created:', populatedSubgroup._id);

    // Emit socket event to all members
    const io = req.app.get('io');
    if (io) {
      participants.forEach(p => {
        io.to(`user:${p.user}`).emit('subgroup:created', {
          subgroup: populatedSubgroup,
          parentGroup: parentGroup
        });
      });
    }

    res.status(201).json({
      success: true,
      data: populatedSubgroup
    });
  } catch (error) {
    console.error('[SUBGROUP] Create error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subgroup',
      error: error.message
    });
  }
};

// @desc    Get all subgroups of a group
// @route   GET /api/groups/:id/subgroups
// @access  Private
exports.getSubgroups = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user.id || req.user._id;

    console.log('[SUBGROUP] Getting subgroups:', groupId);

    // Verify user is member of parent group
    const parentGroup = await Conversation.findById(groupId);

    if (!parentGroup) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    if (!parentGroup.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }

    // Get all subgroups
    const subgroups = await Conversation.find({
      _id: { $in: parentGroup.subgroups },
      isSubgroup: true,
      'participants.user': userId,
      'participants.isActive': true
    })
      .populate('participants.user', 'username fullName profilePicture')
      .populate('createdBy', 'username fullName profilePicture')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username fullName profilePicture' }
      })
      .sort({ lastMessageAt: -1 });

    console.log('[SUBGROUP] Found subgroups:', subgroups.length);

    res.json({
      success: true,
      data: subgroups
    });
  } catch (error) {
    console.error('[SUBGROUP] Get subgroups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subgroups',
      error: error.message
    });
  }
};

// @desc    Delete a subgroup
// @route   DELETE /api/groups/:id/subgroups/:subgroupId
// @access  Private (Parent group admin only)
exports.deleteSubgroup = async (req, res) => {
  try {
    const { id: groupId, subgroupId } = req.params;
    const userId = req.user.id || req.user._id;

    console.log('[SUBGROUP] Deleting subgroup:', { groupId, subgroupId });

    // Get parent group
    const parentGroup = await Conversation.findById(groupId);

    if (!parentGroup) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    // Check if user is admin of parent group
    if (!parentGroup.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only parent group admins can delete subgroups'
      });
    }

    // Get subgroup
    const subgroup = await Conversation.findById(subgroupId);

    if (!subgroup) {
      return res.status(404).json({
        success: false,
        message: 'Subgroup not found'
      });
    }

    // Verify it's a subgroup of this parent
    if (subgroup.parentGroup?.toString() !== groupId) {
      return res.status(400).json({
        success: false,
        message: 'This subgroup does not belong to the specified parent group'
      });
    }

    // Remove from parent's subgroups array
    parentGroup.removeSubgroup(subgroupId);
    await parentGroup.save();

    // Delete the subgroup
    await Conversation.findByIdAndDelete(subgroupId);

    // Delete all messages in the subgroup
    await Message.deleteMany({ conversation: subgroupId });

    console.log('[SUBGROUP] Subgroup deleted:', subgroupId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      subgroup.participants.forEach(p => {
        const participantId = p.user._id || p.user;
        io.to(`user:${participantId}`).emit('subgroup:deleted', {
          subgroupId,
          parentGroupId: groupId
        });
      });
    }

    res.json({
      success: true,
      message: 'Subgroup deleted successfully'
    });
  } catch (error) {
    console.error('[SUBGROUP] Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subgroup',
      error: error.message
    });
  }
};