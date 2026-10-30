const mongoose = require('mongoose');

const APPOINTMENT_TYPES = [
  'academic_doubt',
  'assignment_discussion',
  'exam_prep',
  'project_guidance',
  'research_discussion',
  'career_guidance',
  'mentoring',
  'other'
];

const APPOINTMENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'rescheduled',
  'cancelled',
  'completed',
  'no_show'
];

const MEETING_MODES = ['in_person', 'online'];

const appointmentHistorySchema = new mongoose.Schema(
  {
    previousStatus: { type: String },
    newStatus: { type: String, required: true },
    previousDate: { type: String },
    previousStartTime: { type: String },
    previousEndTime: { type: String },
    newDate: { type: String },
    newStartTime: { type: String },
    newEndTime: { type: String },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actorRole: { type: String },
    reason: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: true }
);

const appointmentNotesSchema = new mongoose.Schema(
  {
    privateSummary: { type: String, trim: true },
    discussionTopics: [{ type: String, trim: true }],
    actionItems: [{ type: String, trim: true }],
    followUpRequired: { type: Boolean, default: false },
    followUpDate: { type: String },
    recordedAt: { type: Date, default: Date.now },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student is required']
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty is required']
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    },
    title: {
      type: String,
      required: [true, 'Appointment title is required'],
      trim: true,
      maxlength: 200
    },
    appointmentType: {
      type: String,
      required: [true, 'Appointment type is required'],
      enum: APPOINTMENT_TYPES,
      default: 'academic_doubt'
    },
    description: {
      type: String,
      required: [true, 'Description or reason is required'],
      trim: true,
      maxlength: 1000
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Appointment date is required'],
      trim: true
    },
    startTime: {
      type: String, // 'HH:mm'
      required: [true, 'Start time is required'],
      trim: true
    },
    endTime: {
      type: String, // 'HH:mm'
      required: [true, 'End time is required'],
      trim: true
    },
    durationMinutes: {
      type: Number,
      required: true,
      default: 30,
      min: 15,
      max: 180
    },
    meetingMode: {
      type: String,
      enum: MEETING_MODES,
      default: 'in_person'
    },
    location: {
      type: String,
      trim: true,
      default: 'Faculty Cabin'
    },
    meetingUrl: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    rescheduleReason: {
      type: String,
      trim: true
    },
    rescheduledFrom: {
      date: String,
      startTime: String,
      endTime: String
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: {
      type: Date
    },
    history: [appointmentHistorySchema],
    meetingNotes: appointmentNotesSchema
  },
  {
    timestamps: true
  }
);

// Performance & Conflict indexing
appointmentSchema.index({ faculty: 1, date: 1, status: 1 });
appointmentSchema.index({ student: 1, date: 1, status: 1 });
appointmentSchema.index({ faculty: 1, status: 1 });
appointmentSchema.index({ date: 1, startTime: 1, endTime: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = {
  Appointment,
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  MEETING_MODES
};
