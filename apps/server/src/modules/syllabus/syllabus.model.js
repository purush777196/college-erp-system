const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    },
    estimatedHours: { type: Number, default: 2, min: 0.5 },
    plannedCompletionDate: { type: Date, default: null },
    actualCompletionDate: { type: Date, default: null },
    teachingNotes: { type: String, default: '', trim: true },
    displayOrder: { type: Number, default: 1 }
  },
  { _id: true, timestamps: true }
);

const unitSchema = new mongoose.Schema(
  {
    unitNumber: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    plannedHours: { type: Number, default: 8 },
    plannedStartDate: { type: Date, default: null },
    targetCompletionDate: { type: Date, default: null },
    displayOrder: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    },
    completedAt: { type: Date, default: null },
    completionRemarks: { type: String, default: '', trim: true },
    topics: [topicSchema]
  },
  { _id: true }
);

const syllabusProgressSchema = new mongoose.Schema(
  {
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true
    },
    academicYear: {
      type: String,
      default: '2025-26'
    },
    units: [unitSchema]
  },
  { timestamps: true }
);

syllabusProgressSchema.index({ subject: 1, faculty: 1 }, { unique: true });

const progressHistorySchema = new mongoose.Schema(
  {
    syllabus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SyllabusProgress',
      required: true,
      index: true
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true
    },
    unitId: { type: mongoose.Schema.Types.ObjectId, default: null },
    unitNumber: { type: Number, default: null },
    unitTitle: { type: String, default: '' },
    topicId: { type: mongoose.Schema.Types.ObjectId, default: null },
    topicTitle: { type: String, default: '' },
    previousStatus: { type: String, default: 'not_started' },
    newStatus: { type: String, required: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

progressHistorySchema.index({ subject: 1, faculty: 1, createdAt: -1 });

const SyllabusProgress = mongoose.model('SyllabusProgress', syllabusProgressSchema);
const SyllabusHistory = mongoose.model('SyllabusHistory', progressHistorySchema);

SyllabusProgress.SyllabusHistory = SyllabusHistory;

module.exports = SyllabusProgress;
