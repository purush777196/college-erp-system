const mongoose = require('mongoose');
const { CalendarEvent } = require('./calendar.model');
const { Assignment } = require('../assignments/assignment.model');
const Examination = require('../examinations/exam.model');
const { Appointment } = require('../appointments/appointment.model');
const Timetable = require('../timetable/timetable.model');
const Notice = require('../notices/notice.model');
const Faculty = require('../faculty/faculty.model');
const logger = require('../../utils/logger');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Aggregates all calendar events for a faculty member within a date range.
 * Combines personal events, assignment deadlines, examinations, appointments,
 * timetable classes, and institutional holidays.
 */
async function getAggregatedCalendarEvents({ facultyId, startDate, endDate, category, search }) {
  const facDocId = new mongoose.Types.ObjectId(facultyId);

  // Default to a 3-month window centered around current date if not specified
  const now = new Date();
  const rangeStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const rangeEnd = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

  // Fetch faculty profile for department information
  let facultyProfile = null;
  try {
    const query = Faculty.findById(facDocId);
    if (query && query.populate) {
      const pop = query.populate('department');
      facultyProfile = pop && pop.lean ? await pop.lean() : await pop;
    } else if (query && query.lean) {
      facultyProfile = await query.lean();
    } else {
      facultyProfile = await query;
    }
  } catch (e) {
    logger.warn('Could not fetch faculty profile:', e.message);
  }

  const events = [];

  // 1. Faculty Personal Events
  try {
    const personalQuery = {
      faculty: facDocId,
      $or: [
        { startDate: { $gte: rangeStart, $lte: rangeEnd } },
        { endDate: { $gte: rangeStart, $lte: rangeEnd } },
        { startDate: { $lte: rangeStart }, endDate: { $gte: rangeEnd } }
      ]
    };

    const personalDocs = await CalendarEvent.find(personalQuery).lean();
    for (const doc of personalDocs) {
      events.push({
        id: doc._id.toString(),
        _id: doc._id.toString(),
        title: doc.title,
        description: doc.description || '',
        category: doc.category || 'Personal Events',
        startDate: doc.startDate,
        endDate: doc.endDate,
        allDay: Boolean(doc.allDay),
        location: doc.location || '',
        priority: doc.priority || 'normal',
        status: doc.status || 'scheduled',
        reminders: doc.reminders || [],
        sourceType: 'personal',
        isPersonalEvent: true,
        isReadOnly: false,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      });
    }
  } catch (err) {
    logger.warn('Failed to load personal events:', err.message);
  }

  // 2. Faculty Assignments (due dates)
  try {
    const assignmentDocs = await Assignment.find({
      faculty: facDocId,
      dueDate: { $gte: rangeStart, $lte: rangeEnd }
    })
      .populate('subject', 'name code')
      .populate('course', 'name code')
      .lean();

    for (const doc of assignmentDocs) {
      const subjectName = doc.subject?.name || 'General';
      const subjectCode = doc.subject?.code ? ` (${doc.subject.code})` : '';
      events.push({
        id: `assignment_${doc._id}`,
        _id: doc._id.toString(),
        title: `Assignment Due: ${doc.title}`,
        description: `Subject: ${subjectName}${subjectCode}. Submissions Due. Max Marks: ${doc.maxMarks}. Status: ${doc.status}.`,
        category: 'Assignment Deadlines',
        startDate: doc.dueDate,
        endDate: doc.dueDate,
        allDay: false,
        location: 'Online Submission Portal',
        priority: doc.status === 'deadline_passed' ? 'low' : 'normal',
        status: doc.status,
        sourceType: 'assignment',
        isPersonalEvent: false,
        isReadOnly: true,
        sourceMetadata: {
          subjectName,
          subjectCode: doc.subject?.code,
          maxMarks: doc.maxMarks,
          status: doc.status
        }
      });
    }
  } catch (err) {
    logger.warn('Failed to load assignment events:', err.message);
  }

  // 3. Institutional Examinations
  try {
    const examQuery = {
      $or: [
        { startDate: { $gte: rangeStart, $lte: rangeEnd } },
        { endDate: { $gte: rangeStart, $lte: rangeEnd } },
        { startDate: { $lte: rangeStart }, endDate: { $gte: rangeEnd } }
      ]
    };
    if (facultyProfile?.department) {
      const deptId = facultyProfile.department._id || facultyProfile.department;
      examQuery.$or.push({ department: deptId });
    }

    const examDocs = await Examination.find(examQuery)
      .populate('department', 'name')
      .populate('course', 'name')
      .lean();

    for (const doc of examDocs) {
      events.push({
        id: `exam_${doc._id}`,
        _id: doc._id.toString(),
        title: `Exam: ${doc.name} (${doc.examType})`,
        description: `Academic Year: ${doc.academicYear}, Semester: ${doc.semester}. Venue: ${doc.venue || 'Exam Hall'}.`,
        category: 'Examinations',
        startDate: doc.startDate,
        endDate: doc.endDate,
        allDay: true,
        location: doc.venue || 'Main Examination Hall',
        priority: 'urgent',
        status: doc.status || 'scheduled',
        sourceType: 'examination',
        isPersonalEvent: false,
        isReadOnly: true,
        sourceMetadata: {
          examType: doc.examType,
          academicYear: doc.academicYear,
          semester: doc.semester,
          venue: doc.venue
        }
      });
    }
  } catch (err) {
    logger.warn('Failed to load examination events:', err.message);
  }

  // 4. Student Appointments (Strictly excluding privateSummary)
  try {
    const appointmentDocs = await Appointment.find({
      faculty: facDocId,
      status: { $ne: 'cancelled' }
    })
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName email' }
      })
      .populate('subject', 'name code')
      .lean();

    for (const doc of appointmentDocs) {
      if (!doc.date || !doc.startTime) continue;
      const aptStart = new Date(`${doc.date}T${doc.startTime}:00`);
      const aptEnd = doc.endTime ? new Date(`${doc.date}T${doc.endTime}:00`) : new Date(aptStart.getTime() + (doc.durationMinutes || 30) * 60000);

      // Check if within window
      if (aptStart < rangeStart || aptStart > rangeEnd) continue;

      const studentName = doc.student?.user
        ? `${doc.student.user.firstName || ''} ${doc.student.user.lastName || ''}`.trim()
        : 'Student';

      events.push({
        id: `appointment_${doc._id}`,
        _id: doc._id.toString(),
        title: `Appointment: ${doc.title} (${studentName})`,
        description: `Consultation with ${studentName}. Purpose: ${doc.appointmentType.replace(/_/g, ' ')}. Mode: ${doc.meetingMode}. Status: ${doc.status}.`,
        category: 'Student Appointments',
        startDate: aptStart,
        endDate: aptEnd,
        allDay: false,
        location: doc.location || (doc.meetingMode === 'online' ? 'Online Video Meeting' : 'Faculty Cabin'),
        priority: doc.status === 'approved' ? 'normal' : 'low',
        status: doc.status,
        sourceType: 'appointment',
        isPersonalEvent: false,
        isReadOnly: true,
        sourceMetadata: {
          studentName,
          appointmentType: doc.appointmentType,
          meetingMode: doc.meetingMode,
          status: doc.status
        }
        // Note: meetingNotes.privateSummary is deliberately excluded!
      });
    }
  } catch (err) {
    logger.warn('Failed to load appointment events:', err.message);
  }

  // 5. Timetable Weekly Teaching Schedule
  try {
    const timetableSlots = await Timetable.find({ faculty: facDocId })
      .populate('subject', 'name code')
      .populate('course', 'name code')
      .lean();

    if (timetableSlots.length > 0) {
      // Expand recurring weekly slots across dates in the range (up to 30 days max to prevent large arrays)
      const maxRangeDays = 45;
      const startMs = rangeStart.getTime();
      const endMs = Math.min(rangeEnd.getTime(), startMs + maxRangeDays * 24 * 60 * 60 * 1000);

      const cursor = new Date(startMs);
      while (cursor.getTime() <= endMs) {
        const dayName = DAY_NAMES[cursor.getDay()];
        const matchingSlots = timetableSlots.filter((slot) => slot.dayOfWeek === dayName);

        for (const slot of matchingSlots) {
          const dateStr = cursor.toISOString().slice(0, 10);
          const startDateTime = new Date(`${dateStr}T${slot.startTime}:00`);
          const endDateTime = new Date(`${dateStr}T${slot.endTime}:00`);
          const subjName = slot.subject?.name || 'Class Lecture';
          const subjCode = slot.subject?.code ? ` (${slot.subject.code})` : '';

          events.push({
            id: `timetable_${slot._id}_${dateStr}`,
            _id: slot._id.toString(),
            title: `Class: ${subjName}${subjCode}`,
            description: `Room: ${slot.roomNumber || 'TBD'}. Course: ${slot.course?.name || ''} Sem ${slot.semester} Sec ${slot.section || 'A'}.`,
            category: 'Academic Events',
            startDate: startDateTime,
            endDate: endDateTime,
            allDay: false,
            location: slot.roomNumber ? `Room ${slot.roomNumber}` : 'Lecture Hall',
            priority: 'normal',
            status: 'scheduled',
            sourceType: 'timetable',
            isPersonalEvent: false,
            isReadOnly: true,
            sourceMetadata: {
              roomNumber: slot.roomNumber,
              periodNumber: slot.periodNumber,
              semester: slot.semester,
              section: slot.section
            }
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  } catch (err) {
    logger.warn('Failed to load timetable events:', err.message);
  }

  // 6. Institutional Notices / Holidays
  try {
    const noticeDocs = await Notice.find({
      status: 'published',
      category: { $in: ['Holiday', 'Academic', 'Emergency'] },
      publicationDate: { $gte: rangeStart, $lte: rangeEnd }
    }).lean();

    for (const doc of noticeDocs) {
      const isHoliday = doc.category === 'Holiday';
      events.push({
        id: `notice_${doc._id}`,
        _id: doc._id.toString(),
        title: `${isHoliday ? 'Holiday: ' : 'Announcement: '}${doc.title}`,
        description: doc.content || '',
        category: isHoliday ? 'Holidays' : 'Academic Events',
        startDate: doc.publicationDate,
        endDate: doc.expiryDate || doc.publicationDate,
        allDay: true,
        location: 'Campus Wide',
        priority: doc.priority || 'normal',
        status: 'published',
        sourceType: 'notice',
        isPersonalEvent: false,
        isReadOnly: true
      });
    }
  } catch (err) {
    logger.warn('Failed to load notices/holidays:', err.message);
  }

  // Apply filters
  let filtered = events;

  if (category && category !== 'all') {
    filtered = filtered.filter(
      (ev) => ev.category && ev.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (search && search.trim()) {
    const searchLower = search.trim().toLowerCase();
    filtered = filtered.filter(
      (ev) =>
        (ev.title && ev.title.toLowerCase().includes(searchLower)) ||
        (ev.description && ev.description.toLowerCase().includes(searchLower)) ||
        (ev.location && ev.location.toLowerCase().includes(searchLower))
    );
  }

  // Sort chronologically
  filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  return {
    events: filtered,
    total: filtered.length,
    rangeStart,
    rangeEnd
  };
}

module.exports = {
  getAggregatedCalendarEvents
};
