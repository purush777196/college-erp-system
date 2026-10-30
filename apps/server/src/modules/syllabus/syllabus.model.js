const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    unitNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    plannedHours: { type: Number, default: 8 },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    },
    completedAt: { type: Date, default: null },
    completionRemarks: { type: String, default: '' }
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

const SyllabusProgress = mongoose.model('SyllabusProgress', syllabusProgressSchema);

module.exports = SyllabusProgress;
