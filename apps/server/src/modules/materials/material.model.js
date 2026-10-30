const mongoose = require('mongoose');

const learningMaterialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Resource title is required'],
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
    resourceType: {
      type: String,
      enum: ['file', 'link'],
      default: 'file'
    },
    category: {
      type: String,
      enum: [
        'Lecture Notes',
        'Presentations',
        'Reference Books',
        'Practice Problems',
        'Previous Question Papers',
        'Lab Manuals',
        'Tutorials',
        'Videos',
        'Assignments Reference',
        'Other'
      ],
      default: 'Lecture Notes'
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    unitNumber: {
      type: Number,
      default: 1
    },
    unitTitle: {
      type: String,
      default: '',
      trim: true
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    topicTitle: {
      type: String,
      default: '',
      trim: true
    },
    fileName: {
      type: String,
      default: ''
    },
    fileUrl: {
      type: String,
      default: ''
    },
    fileData: {
      type: String,
      default: ''
    },
    fileType: {
      type: String,
      default: 'application/pdf'
    },
    fileSize: {
      type: Number,
      default: 1048576
    },
    externalUrl: {
      type: String,
      default: '',
      trim: true
    },
    visibility: {
      type: String,
      enum: ['faculty_only', 'student_accessible'],
      default: 'student_accessible'
    },
    publicationStatus: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    academicYear: {
      type: String,
      default: '2025-26'
    },
    semester: {
      type: Number,
      default: 1
    },
    section: {
      type: String,
      default: 'All'
    },
    viewCount: {
      type: Number,
      default: 0
    },
    downloadCount: {
      type: Number,
      default: 0
    },
    lastAccessedAt: {
      type: Date,
      default: null
    },
    isPublished: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

learningMaterialSchema.index({ subject: 1, faculty: 1, publicationStatus: 1 });
learningMaterialSchema.index({ category: 1, visibility: 1 });

const LearningMaterial = mongoose.model('LearningMaterial', learningMaterialSchema);

module.exports = LearningMaterial;
