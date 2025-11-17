const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Call = require('../models/Call');
const User = require('../models/User');

// Get call history
router.get('/history', protect, async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [
        { caller: req.user.id },
        { receiver: req.user.id }
      ]
    })
      .populate('caller', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(calls);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single call
router.get('/:callId', protect, async (req, res) => {
  try {
    const call = await Call.findById(req.params.callId)
      .populate('caller', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const isParticipant = 
      call.caller._id.toString() === req.user.id ||
      call.receiver._id.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(call);
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new call
router.post('/initiate', protect, async (req, res) => {
  try {
    const { receiverId, callType } = req.body;

    if (!receiverId || !callType) {
      return res.status(400).json({ error: 'Receiver and call type required' });
    }

    if (!['voice', 'video'].includes(callType)) {
      return res.status(400).json({ error: 'Invalid call type' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (receiver.isOnline === false) {
      return res.status(400).json({ error: 'User is offline' });
    }

    const call = new Call({
      caller: req.user.id,
      receiver: receiverId,
      callType,
      status: 'ringing'
    });

    await call.save();

    const populatedCall = await Call.findById(call._id)
      .populate('caller', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    res.status(201).json(populatedCall);
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update call status
router.put('/:callId', protect, async (req, res) => {
  try {
    const { status, answeredAt, endTime } = req.body;
    const call = await Call.findById(req.params.callId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const isParticipant = 
      call.caller.toString() === req.user.id ||
      call.receiver.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (status) call.status = status;
    if (answeredAt) call.answeredAt = answeredAt;
    if (endTime) call.endTime = endTime;

    await call.save();

    const populatedCall = await Call.findById(call._id)
      .populate('caller', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    res.json(populatedCall);
  } catch (error) {
    console.error('Update call error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete call from history
router.delete('/:callId', protect, async (req, res) => {
  try {
    const call = await Call.findById(req.params.callId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const isParticipant = 
      call.caller.toString() === req.user.id ||
      call.receiver.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await Call.findByIdAndDelete(req.params.callId);

    res.json({ message: 'Call deleted from history' });
  } catch (error) {
    console.error('Delete call error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
