const mongoose = require('mongoose');

const CALENDAR_CATEGORIES = [
  'Academic Events',
  'Examinations',
  'Assignment Deadlines',
  'Faculty Meetings',
  'Department Meetings',
  'Department Meeting',
  'Student Appointments',
  'Project Review',
  'Research Work',
  'Preparation Session',
  'Administrative Work',
  'Personal Academic Event',
  'Holidays',
  'Personal Events',
  'Other'
];

const EVENT_PRIORITIES = ['low', 'normal', 'urgent'];
const EVENT_STATUSES = ['scheduled', 'completed', 'cancelled'];

const reminderItemSchema = new mongoose.Schema(
  {
    intervalMinutes: {
      type: Number,
      required: true,
      min: [1, 'Reminder interval must be at least 1 minute'],
      max: [43200, 'Reminder interval cannot exceed 30 days'] // 30 days
    },
    label: {
      type: String,
      trim: true,
      default: ''
    },
    isDelivered: {
      type: Boolean,
      default: false
    }
  },
  { _id: true }
);

const calendarEventSchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty reference is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    category: {
      type: String,
      enum: {
        values: CALENDAR_CATEGORIES,
        message: 'Invalid calendar event category'
      },
      default: 'Personal Events'
    },
    startDate: {
      type: Date,
      required: [true, 'Start date/time is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date/time is required']
    },
    allDay: {
      type: Boolean,
      default: false
    },
    location: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Location cannot exceed 200 characters']
    },
    priority: {
      type: String,
      enum: {
        values: EVENT_PRIORITIES,
        message: 'Priority must be low, normal, or urgent'
      },
      default: 'normal'
    },
    status: {
      type: String,
      enum: {
        values: EVENT_STATUSES,
        message: 'Status must be scheduled, completed, or cancelled'
      },
      default: 'scheduled'
    },
    reminders: [reminderItemSchema]
  },
  {
    timestamps: true
  }
);

calendarEventSchema.index({ faculty: 1, startDate: 1, endDate: 1 });
calendarEventSchema.index({ status: 1, 'reminders.isDelivered': 1, startDate: 1 });

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);

module.exports = {
  CalendarEvent,
  CALENDAR_CATEGORIES,
  EVENT_PRIORITIES,
  EVENT_STATUSES
};
