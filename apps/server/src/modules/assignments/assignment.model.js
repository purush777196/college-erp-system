const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, default: 'application/pdf' },
    fileSize: { type: Number, default: 0 }
  },
  { _id: true }
);

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assignment title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required']
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'Faculty reference is required']
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: 1,
      max: 8
    },
    section: {
      type: String,
      trim: true,
      default: 'A'
    },
    maxMarks: {
      type: Number,
      required: [true, 'Maximum marks are required'],
      min: [1, 'Maximum marks must be at least 1'],
      default: 20
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'active', 'deadline_passed', 'completed'],
      default: 'draft'
    },
    publishDate: {
      type: Date,
      default: null
    },
    dueDate: {
      type: Date,
      required: [true, 'Submission deadline is required']
    },
    instructions: {
      type: String,
      trim: true,
      default: ''
    },
    attachments: [attachmentSchema]
  },
  { timestamps: true }
);

const submissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: [true, 'Assignment reference is required']
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required']
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    content: {
      type: String,
      trim: true,
      default: ''
    },
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: ['submitted', 'evaluated', 'late', 'pending'],
      default: 'submitted'
    },
    marksObtained: {
      type: Number,
      min: [0, 'Marks obtained cannot be negative'],
      default: null
    },
    feedback: {
      type: String,
      trim: true,
      default: ''
    },
    evaluatedAt: {
      type: Date,
      default: null
    },
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      default: null
    }
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

const Assignment = mongoose.model('Assignment', assignmentSchema);
const Submission = mongoose.model('Submission', submissionSchema);

module.exports = {
  Assignment,
  Submission
};
