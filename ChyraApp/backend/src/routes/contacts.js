const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const { protect } = require('../middleware/auth');

// Helper: Hash phone number for privacy
function hashPhone(phoneNumber) {
  return crypto.createHash('sha256').update(phoneNumber).digest('hex');
}

// @route   POST /api/contacts/sync
// @desc    Sync phone contacts and find registered users
// @access  Private
router.post('/sync', protect, async (req, res) => {
  try {
    const { contacts } = req.body;
    
    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid contacts data. Expected array of contacts.' 
      });
    }

    // Extract and normalize phone numbers from multiple formats
    const phoneNumbers = contacts
      .map(contact => {
        // Handle different contact formats
        if (typeof contact === 'string') return contact;
        return contact.phone || contact.phoneNumber || contact.tel;
      })
      .filter(Boolean)
      .map(phone => {
        // Remove all non-digit characters except leading +
        let cleaned = phone.toString().replace(/[\s\-\(\)\.]/g, '');
        // Ensure it starts with +
        if (!cleaned.startsWith('+')) {
          cleaned = '+' + cleaned;
        }
        return cleaned;
      })
      .filter(phone => phone.length >= 10); // Valid phone numbers only

    if (phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid phone numbers provided'
      });
    }

    console.log(`Syncing ${phoneNumbers.length} contacts for user ${req.user.id}`);

    // Find registered users by phone number
    const registeredUsers = await User.find({
      phoneNumber: { $in: phoneNumbers },
      _id: { $ne: req.user.id }
    }).select('username email phoneNumber profilePicture fullName bio status isOnline');

    // Get existing friend requests
    const friendRequests = await FriendRequest.find({
      $or: [
        { sender: req.user.id },
        { receiver: req.user.id }
      ]
    });

    // Get user's current friends
    const currentUser = await User.findById(req.user.id).select('friends');
    
    // Map contacts with friendship status
    const contactsWithStatus = registeredUsers.map(user => {
      const contact = contacts.find(c => {
        let contactPhone = '';
        if (typeof c === 'string') {
          contactPhone = c;
        } else {
          contactPhone = c.phone || c.phoneNumber || c.tel || '';
        }
        
        const cleaned = contactPhone.toString().replace(/[\s\-\(\)\.]/g, '');
        const withPlus = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
        
        return withPlus === user.phoneNumber || cleaned === user.phoneNumber.replace('+', '');
      });

      const isFriend = currentUser.friends.some(
        friendId => friendId.toString() === user._id.toString()
      );

      const sentRequest = friendRequests.find(
        fr => fr.sender.toString() === req.user.id && 
              fr.receiver.toString() === user._id.toString()
      );

      const receivedRequest = friendRequests.find(
        fr => fr.receiver.toString() === req.user.id && 
              fr.sender.toString() === user._id.toString()
      );

      let friendshipStatus = 'not_friend';
      if (isFriend) friendshipStatus = 'friend';
      else if (sentRequest) friendshipStatus = sentRequest.status;
      else if (receivedRequest) friendshipStatus = 'received_request';

      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
        fullName: user.fullName,
        bio: user.bio,
        status: user.status,
        isOnline: user.isOnline,
        contactName: typeof contact === 'object' ? contact.name : undefined,
        friendshipStatus
      };
    });

    // Store hashed contacts for privacy (optional - for future features)
    const hashedContacts = phoneNumbers.map(phone => ({
      phoneHash: hashPhone(phone),
      addedAt: new Date()
    }));

    await User.findByIdAndUpdate(req.user.id, {
      syncedContacts: hashedContacts
    });

    console.log(`Found ${contactsWithStatus.length} matches for user ${req.user.id}`);

    res.json({ 
      success: true,
      message: `Found ${contactsWithStatus.length} contacts on ChyraApp`,
      data: {
        matches: contactsWithStatus, // ✅ Use 'matches' for frontend
        contacts: contactsWithStatus, // Keep 'contacts' for backward compatibility
        totalScanned: phoneNumbers.length,
        totalMatched: contactsWithStatus.length,
        total: contactsWithStatus.length,
        synced: phoneNumbers.length
      }
    });
  } catch (error) {
    console.error('Contact sync error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to sync contacts. Please try again.' 
    });
  }
});

// @route   GET /api/contacts/search-phone
// @desc    Search user by phone number
// @access  Private
router.get('/search-phone', protect, async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Clean and normalize phone number
    let cleanPhone = phone.toString().replace(/[\s\-\(\)\.]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    console.log(`Searching for phone: ${cleanPhone}`);

    const user = await User.findOne({
      phoneNumber: cleanPhone,
      _id: { $ne: req.user.id },
      isActive: true
    }).select('username fullName phoneNumber profilePicture status bio phoneVisibility friends isOnline');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this phone number'
      });
    }

    // Check phone visibility
    const canSeePhone = 
      user.phoneVisibility === 'everyone' ||
      (user.phoneVisibility === 'contacts' && user.friends.includes(req.user.id));

    const userData = {
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      profilePicture: user.profilePicture,
      status: user.status,
      bio: user.bio,
      isOnline: user.isOnline,
      phoneNumber: canSeePhone ? user.phoneNumber : undefined
    };

    res.json({
      success: true,
      data: { user: userData }
    });
  } catch (error) {
    console.error('Phone search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search. Please try again.'
    });
  }
});

// @route   POST /api/contacts/request
// @desc    Send friend request
// @access  Private
router.post('/request', protect, async (req, res) => {
  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({ 
        success: false,
        message: 'Receiver ID required' 
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const sender = await User.findById(req.user.id);
    
    // Check if already friends
    if (sender.friends && sender.friends.some(id => id.toString() === receiverId)) {
      return res.status(400).json({ 
        success: false,
        message: 'You are already friends with this user' 
      });
    }

    // Check for existing request
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: req.user.id, receiver: receiverId },
        { sender: receiverId, receiver: req.user.id }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ 
          success: false,
          message: 'Friend request already exists' 
        });
      }
      // If rejected, delete old request and create new one
      await existingRequest.deleteOne();
    }

    const friendRequest = new FriendRequest({
      sender: req.user.id,
      receiver: receiverId,
      status: 'pending'
    });

    await friendRequest.save();

    // Emit socket event if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${receiverId}`).emit('friend_request_received', {
        requestId: friendRequest._id,
        sender: {
          _id: sender._id,
          username: sender.username,
          profilePicture: sender.profilePicture
        }
      });
    }

    res.status(201).json({ 
      success: true,
      message: 'Friend request sent successfully',
      data: { friendRequest }
    });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send friend request. Please try again.' 
    });
  }
});

// @route   GET /api/contacts/requests
// @desc    Get all friend requests
// @access  Private
router.get('/requests', protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      $or: [
        { sender: req.user.id },
        { receiver: req.user.id }
      ]
    })
    .populate('sender', 'username email phoneNumber profilePicture fullName')
    .populate('receiver', 'username email phoneNumber profilePicture fullName')
    .sort({ createdAt: -1 });

    const sentRequests = requests.filter(r => 
      r.sender._id.toString() === req.user.id
    );
    const receivedRequests = requests.filter(r => 
      r.receiver._id.toString() === req.user.id && r.status === 'pending'
    );

    res.json({ 
      success: true,
      data: {
        sent: sentRequests,
        received: receivedRequests
      }
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load friend requests' 
    });
  }
});

// @route   PUT /api/contacts/request/:id/accept
// @desc    Accept friend request
// @access  Private
router.put('/request/:id/accept', protect, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.id);

    if (!friendRequest) {
      return res.status(404).json({ 
        success: false,
        message: 'Friend request not found' 
      });
    }

    if (friendRequest.receiver.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to accept this request' 
      });
    }

    if (friendRequest.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Friend request already accepted'
      });
    }

    friendRequest.status = 'accepted';
    await friendRequest.save();

    const sender = await User.findById(friendRequest.sender);
    const receiver = await User.findById(friendRequest.receiver);
    
    // Add to friends list
    if (!sender.friends.includes(friendRequest.receiver)) {
      sender.friends.push(friendRequest.receiver);
      await sender.save();
    }
    
    if (!receiver.friends.includes(friendRequest.sender)) {
      receiver.friends.push(friendRequest.sender);
      await receiver.save();
    }

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendRequest.sender}`).emit('friend_request_accepted', {
        userId: receiver._id,
        username: receiver.username
      });
    }

    res.json({ 
      success: true,
      message: 'Friend request accepted', 
      data: { friendRequest }
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to accept friend request' 
    });
  }
});

// @route   PUT /api/contacts/request/:id/reject
// @desc    Reject friend request
// @access  Private
router.put('/request/:id/reject', protect, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.id);

    if (!friendRequest) {
      return res.status(404).json({ 
        success: false,
        message: 'Friend request not found' 
      });
    }

    if (friendRequest.receiver.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to reject this request' 
      });
    }

    friendRequest.status = 'rejected';
    await friendRequest.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${friendRequest.sender}`).emit('friend_request_rejected', {
        requestId: friendRequest._id
      });
    }

    res.json({ 
      success: true,
      message: 'Friend request rejected' 
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to reject friend request' 
    });
  }
});

// @route   DELETE /api/contacts/request/:id
// @desc    Cancel friend request
// @access  Private
router.delete('/request/:id', protect, async (req, res) => {
  try {
    const friendRequest = await FriendRequest.findById(req.params.id);

    if (!friendRequest) {
      return res.status(404).json({ 
        success: false,
        message: 'Friend request not found' 
      });
    }

    if (friendRequest.sender.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to cancel this request' 
      });
    }

    await friendRequest.deleteOne();

    res.json({ 
      success: true,
      message: 'Friend request cancelled' 
    });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to cancel friend request' 
    });
  }
});

// @route   GET /api/contacts
// @desc    Get user's contacts/friends
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('friends', 'username fullName phoneNumber profilePicture bio status isOnline lastSeen');

    res.json({
      success: true,
      data: user.friends || []
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load contacts'
    });
  }
});

// @route   DELETE /api/contacts/:friendId
// @desc    Remove friend
// @access  Private
router.delete('/:friendId', protect, async (req, res) => {
  try {
    const { friendId } = req.params;

    const user = await User.findById(req.user.id);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove from both users' friends lists
    user.friends = user.friends.filter(id => id.toString() !== friendId);
    friend.friends = friend.friends.filter(id => id.toString() !== req.user.id);

    await user.save();
    await friend.save();

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove friend'
    });
  }
});

// @route   PUT /api/contacts/phone-visibility
// @desc    Update phone visibility setting
// @access  Private
router.put('/phone-visibility', protect, async (req, res) => {
  try {
    const { visibility } = req.body;

    if (!['everyone', 'contacts', 'nobody'].includes(visibility)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid visibility option. Use: everyone, contacts, or nobody'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { phoneVisibility: visibility },
      { new: true }
    ).select('phoneVisibility');

    res.json({
      success: true,
      message: 'Phone visibility updated',
      data: { phoneVisibility: user.phoneVisibility }
    });
  } catch (error) {
    console.error('Update visibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update phone visibility'
    });
  }
});

module.exports = router;