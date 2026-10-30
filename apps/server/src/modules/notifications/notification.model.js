const mongoose = require('mongoose');

const NOTIFICATION_CATEGORIES = [
  'reminder',
  'assignment',
  'examination',
  'appointment',
  'academic',
  'system',
  'personal_event'
];

const NOTIFICATION_PRIORITIES = ['low', 'normal', 'urgent'];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Recipient faculty reference is required'],
      index: true
    },
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    category: {
      type: String,
      enum: {
        values: NOTIFICATION_CATEGORIES,
        message: 'Invalid notification category'
      },
      default: 'reminder'
    },
    priority: {
      type: String,
      enum: {
        values: NOTIFICATION_PRIORITIES,
        message: 'Invalid priority level'
      },
      default: 'normal'
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['calendar_event', 'assignment', 'exam', 'appointment', 'timetable', 'notice', 'other'],
        default: 'other'
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      }
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    reminderKey: {
      type: String,
      trim: true,
      sparse: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on recipient + reminderKey ensures idempotent notifications.
// Attempting to deliver the same reminder twice will be blocked cleanly.
notificationSchema.index(
  { recipient: 1, reminderKey: 1 },
  { unique: true, sparse: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

const FacultyNotification = mongoose.model('FacultyNotification', notificationSchema);

module.exports = {
  FacultyNotification,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES
};
