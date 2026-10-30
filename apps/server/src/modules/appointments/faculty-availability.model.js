const mongoose = require('mongoose');

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const timeSlotSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true, trim: true }, // '10:00'
    endTime: { type: String, required: true, trim: true } // '12:00'
  },
  { _id: false }
);

const dayAvailabilitySchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      enum: DAYS_OF_WEEK,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    slots: [timeSlotSchema]
  },
  { _id: false }
);

const breakPeriodSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: String,
      enum: DAYS_OF_WEEK
    },
    startTime: { type: String, required: true, trim: true }, // '13:00'
    endTime: { type: String, required: true, trim: true }, // '14:00'
    label: { type: String, default: 'Lunch Break', trim: true }
  },
  { _id: false }
);

const unavailableDateSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true }, // 'YYYY-MM-DD'
    reason: { type: String, trim: true }
  },
  { _id: false }
);

const facultyAvailabilitySchema = new mongoose.Schema(
  {
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      unique: true
    },
    weeklyAvailability: [dayAvailabilitySchema],
    breakPeriods: [breakPeriodSchema],
    unavailableDates: [unavailableDateSchema],
    appointmentDuration: {
      type: Number,
      default: 30,
      min: 15,
      max: 120
    },
    advanceBookingDays: {
      type: Number,
      default: 14,
      min: 1,
      max: 90
    },
    minimumNoticeHours: {
      type: Number,
      default: 2,
      min: 0,
      max: 72
    },
    maximumAppointmentsPerDay: {
      type: Number,
      default: 8,
      min: 1,
      max: 20
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true
    },
    defaultLocation: {
      type: String,
      default: 'Faculty Cabin',
      trim: true
    },
    defaultMeetingUrl: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

const FacultyAvailability = mongoose.model('FacultyAvailability', facultyAvailabilitySchema);

module.exports = {
  FacultyAvailability,
  DAYS_OF_WEEK
};
