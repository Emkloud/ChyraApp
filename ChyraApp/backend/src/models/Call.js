const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  callType: {
    type: String,
    enum: ['voice', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['ringing', 'ongoing', 'ended', 'missed', 'declined', 'failed'],
    default: 'ringing'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  },
  answeredAt: {
    type: Date
  }
}, {
  timestamps: true
});

callSchema.pre('save', function(next) {
  if (this.endTime && this.answeredAt) {
    this.duration = Math.floor((this.endTime - this.answeredAt) / 1000);
  }
  next();
});

module.exports = mongoose.model('Call', callSchema);
