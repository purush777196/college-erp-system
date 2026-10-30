const mongoose = require('mongoose');
const { Appointment, APPOINTMENT_TYPES, APPOINTMENT_STATUSES, MEETING_MODES } = require('./appointment.model');
const { FacultyAvailability, DAYS_OF_WEEK } = require('./faculty-availability.model');
const {
  checkAppointmentConflicts,
  generateAvailableSlotsForDate,
  getDayOfWeek
} = require('./appointment-conflict.service');
const Faculty = require('../faculty/faculty.model');
const Student = require('../students/student.model');
const Timetable = require('../timetable/timetable.model');
const Subject = require('../subjects/subject.model');
const Department = require('../departments/department.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');

// Helper to resolve Faculty document ID
async function getFacultyDocId(user) {
  if (user?.facultyId) return user.facultyId;
  try {
    const faculty = await Faculty.findOne({ user: user._id || user.id });
    if (faculty) return faculty._id;
  } catch (err) {
    // Mock environments
  }
  return user._id || user.id;
}

// Helper to resolve Student document ID
async function getStudentDocId(user) {
  if (user?.studentId) return user.studentId;
  try {
    const student = await Student.findOne({ user: user._id || user.id });
    if (student) return student._id;
  } catch (err) {
    // Mock environments
  }
  return user._id || user.id;
}

/**
 * Get or initialize faculty availability
 * GET /api/v1/faculty/me/appointments/availability
 */
async function getFacultyAvailability(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    let availability = await FacultyAvailability.findOne({ faculty: facId });

    if (!availability) {
      // Initialize default availability (Mon - Fri, 10:00 - 12:30 & 14:00 - 16:00, lunch break 13:00 - 14:00)
      const defaultWeekly = DAYS_OF_WEEK.map((day) => ({
        dayOfWeek: day,
        isActive: day !== 'Sunday',
        slots: day !== 'Sunday'
          ? [
              { startTime: '10:00', endTime: '12:30' },
              { startTime: '14:00', endTime: '16:00' }
            ]
          : []
      }));

      availability = await FacultyAvailability.create({
        faculty: facId,
        weeklyAvailability: defaultWeekly,
        breakPeriods: [
          { dayOfWeek: 'Monday', startTime: '13:00', endTime: '14:00', label: 'Lunch Break' },
          { dayOfWeek: 'Tuesday', startTime: '13:00', endTime: '14:00', label: 'Lunch Break' },
          { dayOfWeek: 'Wednesday', startTime: '13:00', endTime: '14:00', label: 'Lunch Break' },
          { dayOfWeek: 'Thursday', startTime: '13:00', endTime: '14:00', label: 'Lunch Break' },
          { dayOfWeek: 'Friday', startTime: '13:00', endTime: '14:00', label: 'Lunch Break' },
          { dayOfWeek: 'Saturday', startTime: '13:00', endTime: '14:00', label: 'Lunch Break' }
        ],
        unavailableDates: [],
        appointmentDuration: 30,
        advanceBookingDays: 14,
        minimumNoticeHours: 2,
        maximumAppointmentsPerDay: 8,
        timezone: 'Asia/Kolkata',
        defaultLocation: 'Faculty Cabin'
      });
    }

    return sendSuccess(res, {
      message: 'Faculty availability retrieved successfully',
      data: availability
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update faculty availability configuration
 * PUT /api/v1/faculty/me/appointments/availability
 */
async function updateFacultyAvailability(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const {
      weeklyAvailability,
      breakPeriods,
      unavailableDates,
      appointmentDuration,
      advanceBookingDays,
      minimumNoticeHours,
      maximumAppointmentsPerDay,
      timezone,
      defaultLocation,
      defaultMeetingUrl
    } = req.body;

    let availability = await FacultyAvailability.findOne({ faculty: facId });
    if (!availability) {
      availability = new FacultyAvailability({ faculty: facId });
    }

    if (weeklyAvailability) availability.weeklyAvailability = weeklyAvailability;
    if (breakPeriods) availability.breakPeriods = breakPeriods;
    if (unavailableDates) availability.unavailableDates = unavailableDates;
    if (appointmentDuration !== undefined) availability.appointmentDuration = Number(appointmentDuration);
    if (advanceBookingDays !== undefined) availability.advanceBookingDays = Number(advanceBookingDays);
    if (minimumNoticeHours !== undefined) availability.minimumNoticeHours = Number(minimumNoticeHours);
    if (maximumAppointmentsPerDay !== undefined) availability.maximumAppointmentsPerDay = Number(maximumAppointmentsPerDay);
    if (timezone) availability.timezone = timezone.trim();
    if (defaultLocation !== undefined) availability.defaultLocation = defaultLocation.trim();
    if (defaultMeetingUrl !== undefined) availability.defaultMeetingUrl = defaultMeetingUrl.trim();

    await availability.save();

    return sendSuccess(res, {
      message: 'Faculty availability updated successfully',
      data: availability
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get available slots for a given date
 * GET /api/v1/faculty/me/appointments/availability/slots?date=YYYY-MM-DD
 */
async function getAvailableSlots(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];

    const slots = await generateAvailableSlotsForDate({
      facultyId: facId,
      dateStr
    });

    return sendSuccess(res, {
      message: 'Available slots computed',
      data: {
        date: dateStr,
        dayOfWeek: getDayOfWeek(dateStr),
        slots
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List faculty appointments
 * GET /api/v1/faculty/me/appointments
 */
async function listFacultyAppointments(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const {
      status,
      appointmentType,
      date,
      search,
      page = 1,
      limit = 10,
      sortBy = 'date',
      sortOrder = 'asc'
    } = req.query;

    const query = { faculty: facId };

    if (status) {
      if (status === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        query.date = todayStr;
        query.status = { $in: ['approved', 'rescheduled'] };
      } else if (status === 'upcoming') {
        const todayStr = new Date().toISOString().split('T')[0];
        query.date = { $gte: todayStr };
        query.status = { $in: ['approved', 'rescheduled'] };
      } else if (status === 'cancelled_or_rejected') {
        query.status = { $in: ['cancelled', 'rejected'] };
      } else {
        query.status = status;
      }
    }

    if (appointmentType) {
      query.appointmentType = appointmentType;
    }

    if (date && status !== 'today') {
      query.date = date;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { title: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
        { location: { $regex: s, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sortObj = {};
    if (sortBy === 'date') {
      sortObj.date = sortDirection;
      sortObj.startTime = sortDirection;
    } else {
      sortObj[sortBy] = sortDirection;
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate({
          path: 'student',
          select: 'rollNumber currentSemester department',
          populate: [
            { path: 'user', select: 'name email profileImage' },
            { path: 'department', select: 'name code' }
          ]
        })
        .populate('subject', 'name code')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Appointment.countDocuments(query)
    ]);

    return sendSuccess(res, {
      message: 'Appointments retrieved successfully',
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get faculty appointment summary stats
 * GET /api/v1/faculty/me/appointments/summary
 */
async function getFacultyAppointmentSummary(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const todayStr = new Date().toISOString().split('T')[0];

    const appointments = await Appointment.find({ faculty: facId })
      .select('status date startTime endTime')
      .lean();

    const total = appointments.length;
    const pending = appointments.filter((a) => a.status === 'pending').length;
    const approved = appointments.filter((a) => a.status === 'approved' || a.status === 'rescheduled').length;
    const today = appointments.filter(
      (a) => a.date === todayStr && (a.status === 'approved' || a.status === 'rescheduled')
    ).length;
    const completed = appointments.filter((a) => a.status === 'completed').length;
    const cancelledOrRejected = appointments.filter(
      (a) => a.status === 'cancelled' || a.status === 'rejected' || a.status === 'no_show'
    ).length;

    return sendSuccess(res, {
      message: 'Appointment summary statistics retrieved',
      data: {
        total,
        pending,
        approved,
        today,
        completed,
        cancelledOrRejected
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get monthly calendar view data for faculty
 * GET /api/v1/faculty/me/appointments/calendar?month=YYYY-MM
 */
async function getFacultyCalendarAppointments(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const month = req.query.month || new Date().toISOString().substring(0, 7); // e.g. "2026-10"

    const appointments = await Appointment.find({
      faculty: facId,
      date: { $regex: `^${month}` }
    })
      .populate({
        path: 'student',
        select: 'rollNumber',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('subject', 'name code')
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Also fetch faculty timetable classes
    let timetableSlots = [];
    try {
      timetableSlots = await Timetable.find({ faculty: facId })
        .populate('subject', 'name code')
        .lean();
    } catch (err) {
      // Mock environments
    }

    // Also fetch unavailable dates
    const availability = await FacultyAvailability.findOne({ faculty: facId }).lean();
    const unavailableDates = (availability?.unavailableDates || []).filter((u) =>
      u.date.startsWith(month)
    );

    return sendSuccess(res, {
      message: 'Calendar data retrieved',
      data: {
        month,
        appointments,
        timetableSlots,
        unavailableDates
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single appointment details
 * GET /api/v1/faculty/me/appointments/:id
 */
async function getAppointmentById(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({
        path: 'student',
        select: 'rollNumber currentSemester department',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'department', select: 'name code' }
        ]
      })
      .populate('subject', 'name code')
      .populate('faculty')
      .populate('history.actor', 'name email role');

    if (!appointment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Appointment not found',
        code: 'NOT_FOUND'
      });
    }

    // Role verification
    const facId = await getFacultyDocId(req.user);
    if (req.user.role === ROLES.FACULTY && String(appointment.faculty._id || appointment.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Unauthorized access to appointment',
        code: 'FORBIDDEN'
      });
    }

    if (req.user.role === ROLES.STUDENT) {
      const studId = await getStudentDocId(req.user);
      if (String(appointment.student._id || appointment.student) !== String(studId)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Unauthorized access to appointment',
          code: 'FORBIDDEN'
        });
      }
    }

    const returnData = appointment.toObject ? appointment.toObject() : { ...appointment };
    if (req.user.role === ROLES.STUDENT && returnData.meetingNotes) {
      delete returnData.meetingNotes.privateSummary;
    }

    return sendSuccess(res, {
      message: 'Appointment details retrieved',
      data: returnData
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve appointment request
 * PATCH /api/v1/faculty/me/appointments/:id/approve
 */
async function approveAppointment(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Appointment not found',
        code: 'NOT_FOUND'
      });
    }

    if (String(appointment.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Unauthorized. You are not the requested faculty member.',
        code: 'FORBIDDEN'
      });
    }

    if (!['pending', 'rescheduled'].includes(appointment.status)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Cannot approve appointment with current status: ${appointment.status}`,
        code: 'INVALID_STATUS_TRANSITION'
      });
    }

    // Revalidate conflicts upon approval
    const conflict = await checkAppointmentConflicts({
      facultyId: appointment.faculty,
      studentId: appointment.student,
      dateStr: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      excludeAppointmentId: appointment._id
    });

    if (conflict.hasConflict) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: `Approval conflict detected: ${conflict.message}`,
        code: conflict.type
      });
    }

    const prevStatus = appointment.status;
    appointment.status = 'approved';
    appointment.approvedBy = req.user._id || req.user.id;

    if (req.body.location) appointment.location = req.body.location.trim();
    if (req.body.meetingUrl) appointment.meetingUrl = req.body.meetingUrl.trim();

    appointment.history.push({
      previousStatus: prevStatus,
      newStatus: 'approved',
      actor: req.user._id || req.user.id,
      actorRole: req.user.role,
      reason: req.body.note || 'Approved by faculty member',
      timestamp: new Date()
    });

    await appointment.save();

    return sendSuccess(res, {
      message: 'Appointment request approved successfully',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject appointment request
 * PATCH /api/v1/faculty/me/appointments/:id/reject
 */
async function rejectAppointment(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Appointment not found',
        code: 'NOT_FOUND'
      });
    }

    if (String(appointment.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Unauthorized. You are not the requested faculty member.',
        code: 'FORBIDDEN'
      });
    }

    if (!['pending', 'rescheduled'].includes(appointment.status)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Cannot reject appointment with status: ${appointment.status}`,
        code: 'INVALID_STATUS_TRANSITION'
      });
    }

    const prevStatus = appointment.status;
    appointment.status = 'rejected';
    appointment.rejectionReason = req.body.reason ? req.body.reason.trim() : 'Schedule conflict or unavailable';

    appointment.history.push({
      previousStatus: prevStatus,
      newStatus: 'rejected',
      actor: req.user._id || req.user.id,
      actorRole: req.user.role,
      reason: appointment.rejectionReason,
      timestamp: new Date()
    });

    await appointment.save();

    return sendSuccess(res, {
      message: 'Appointment request rejected',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reschedule appointment
 * PATCH /api/v1/faculty/me/appointments/:id/reschedule
 */
async function rescheduleAppointment(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Appointment not found',
        code: 'NOT_FOUND'
      });
    }

    if (String(appointment.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Unauthorized. You are not the requested faculty member.',
        code: 'FORBIDDEN'
      });
    }

    if (!['pending', 'approved', 'rescheduled'].includes(appointment.status)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Cannot reschedule appointment with status: ${appointment.status}`,
        code: 'INVALID_STATUS_TRANSITION'
      });
    }

    const { newDate, newStartTime, newEndTime, reason } = req.body;
    if (!newDate || !newStartTime || !newEndTime) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'New date, start time, and end time are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Check conflicts for the new time slot
    const conflict = await checkAppointmentConflicts({
      facultyId: appointment.faculty,
      studentId: appointment.student,
      dateStr: newDate.trim(),
      startTime: newStartTime.trim(),
      endTime: newEndTime.trim(),
      excludeAppointmentId: appointment._id
    });

    if (conflict.hasConflict) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: `Rescheduling conflict: ${conflict.message}`,
        code: conflict.type
      });
    }

    const prevDate = appointment.date;
    const prevStart = appointment.startTime;
    const prevEnd = appointment.endTime;
    const prevStatus = appointment.status;

    appointment.rescheduledFrom = {
      date: prevDate,
      startTime: prevStart,
      endTime: prevEnd
    };

    appointment.date = newDate.trim();
    appointment.startTime = newStartTime.trim();
    appointment.endTime = newEndTime.trim();
    appointment.status = 'rescheduled';
    appointment.rescheduleReason = reason ? reason.trim() : 'Rescheduled by faculty';

    appointment.history.push({
      previousStatus: prevStatus,
      newStatus: 'rescheduled',
      previousDate: prevDate,
      previousStartTime: prevStart,
      previousEndTime: prevEnd,
      newDate: appointment.date,
      newStartTime: appointment.startTime,
      newEndTime: appointment.endTime,
      actor: req.user._id || req.user.id,
      actorRole: req.user.role,
      reason: appointment.rescheduleReason,
      timestamp: new Date()
    });

    await appointment.save();

    return sendSuccess(res, {
      message: 'Appointment rescheduled successfully',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel appointment
 * PATCH /api/v1/faculty/me/appointments/:id/cancel
 */
async function cancelAppointment(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Appointment not found',
        code: 'NOT_FOUND'
      });
    }

    // Verify authorized actor (either the faculty or the student)
    const facId = await getFacultyDocId(req.user);
    const studId = await getStudentDocId(req.user);

    const isFacultyOwner = String(appointment.faculty) === String(facId);
    const isStudentOwner = String(appointment.student) === String(studId);

    if (!isFacultyOwner && !isStudentOwner && req.user.role !== ROLES.SUPER_ADMIN) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Unauthorized to cancel this appointment',
        code: 'FORBIDDEN'
      });
    }

    if (['completed', 'rejected', 'cancelled'].includes(appointment.status)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Appointment is already ${appointment.status}`,
        code: 'ALREADY_TERMINATED'
      });
    }

    const prevStatus = appointment.status;
    appointment.status = 'cancelled';
    appointment.cancelledBy = req.user._id || req.user.id;
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = req.body.reason ? req.body.reason.trim() : 'Cancelled';

    appointment.history.push({
      previousStatus: prevStatus,
      newStatus: 'cancelled',
      actor: req.user._id || req.user.id,
      actorRole: req.user.role,
      reason: appointment.cancellationReason,
      timestamp: new Date()
    });

    await appointment.save();

    return sendSuccess(res, {
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark appointment as completed or no-show
 * PATCH /api/v1/faculty/me/appointments/:id/complete
 */
async function completeAppointment(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Appointment not found',
        code: 'NOT_FOUND'
      });
    }

    if (String(appointment.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Unauthorized. You are not the requested faculty member.',
        code: 'FORBIDDEN'
      });
    }

    if (!['approved', 'rescheduled'].includes(appointment.status)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Only approved appointments can be marked as completed.',
        code: 'INVALID_STATUS'
      });
    }

    const targetStatus = req.body.isNoShow ? 'no_show' : 'completed';
    const prevStatus = appointment.status;
    appointment.status = targetStatus;

    appointment.history.push({
      previousStatus: prevStatus,
      newStatus: targetStatus,
      actor: req.user._id || req.user.id,
      actorRole: req.user.role,
      reason: req.body.isNoShow ? 'Student did not show up' : 'Meeting completed successfully',
      timestamp: new Date()
    });

    await appointment.save();

    return sendSuccess(res, {
      message: `Appointment marked as ${targetStatus}`,
      data: appointment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record or update private meeting notes
 * POST /api/v1/faculty/me/appointments/:id/notes
 */
async function saveAppointmentNotes(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Appointment not found',
        code: 'NOT_FOUND'
      });
    }

    if (String(appointment.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Unauthorized. Only the meeting faculty can record private notes.',
        code: 'FORBIDDEN'
      });
    }

    const {
      privateSummary = '',
      discussionTopics = [],
      actionItems = [],
      followUpRequired = false,
      followUpDate = ''
    } = req.body;

    appointment.meetingNotes = {
      privateSummary: privateSummary.trim(),
      discussionTopics: Array.isArray(discussionTopics) ? discussionTopics : [],
      actionItems: Array.isArray(actionItems) ? actionItems : [],
      followUpRequired: Boolean(followUpRequired),
      followUpDate: followUpDate ? followUpDate.trim() : '',
      recordedAt: new Date(),
      recordedBy: req.user._id || req.user.id
    };

    await appointment.save();

    return sendSuccess(res, {
      message: 'Private meeting notes saved successfully',
      data: appointment.meetingNotes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * STUDENT BOOKING ENDPOINTS (Backend implementation ready for integration)
 */

/**
 * Create appointment request from student
 * POST /api/v1/student/appointments
 */
async function createStudentAppointment(req, res, next) {
  try {
    const studentId = await getStudentDocId(req.user);
    const {
      facultyId,
      subjectId,
      title,
      appointmentType = 'academic_doubt',
      description,
      date,
      startTime,
      endTime,
      meetingMode = 'in_person',
      location,
      meetingUrl
    } = req.body;

    if (!facultyId || !title || !description || !date || !startTime || !endTime) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Faculty, title, description, date, start time, and end time are required.',
        code: 'MISSING_FIELDS'
      });
    }

    // Verify academic association
    const isAssociated = await checkFacultyStudentAssociation(facultyId, studentId);
    if (!isAssociated) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'You can only request appointments with faculty members who are academically associated with you.',
        code: 'UNRELATED_FACULTY'
      });
    }

    // Verify appointment conflicts
    const conflict = await checkAppointmentConflicts({
      facultyId,
      studentId,
      dateStr: date.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim()
    });

    if (conflict.hasConflict) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: conflict.message,
        code: conflict.type
      });
    }

    const appointment = await Appointment.create({
      student: studentId,
      faculty: facultyId,
      subject: subjectId || undefined,
      title: title.trim(),
      appointmentType,
      description: description.trim(),
      date: date.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      meetingMode,
      location: meetingMode === 'in_person' ? (location || 'Faculty Cabin').trim() : undefined,
      meetingUrl: meetingMode === 'online' ? (meetingUrl || '').trim() : undefined,
      status: 'pending',
      requestedBy: req.user._id || req.user.id,
      history: [
        {
          previousStatus: null,
          newStatus: 'pending',
          actor: req.user._id || req.user.id,
          actorRole: req.user.role,
          reason: 'Initial student appointment booking request',
          timestamp: new Date()
        }
      ]
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Appointment request submitted successfully',
      data: appointment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List student's own appointments
 * GET /api/v1/student/appointments
 */
async function listStudentAppointments(req, res, next) {
  try {
    const studentId = await getStudentDocId(req.user);
    const { status, page = 1, limit = 10 } = req.query;

    const query = { student: studentId };
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Notice: meetingNotes.privateSummary is explicitly excluded for student security!
    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .select('-meetingNotes.privateSummary')
        .populate({
          path: 'faculty',
          select: 'employeeId department designation',
          populate: [
            { path: 'user', select: 'name email profileImage' },
            { path: 'department', select: 'name code' }
          ]
        })
        .populate('subject', 'name code')
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Appointment.countDocuments(query)
    ]);

    return sendSuccess(res, {
      message: 'Student appointments retrieved successfully',
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to check faculty-student academic association
 */
async function checkFacultyStudentAssociation(facultyId, studentId, user) {
  try {
    let student = null;
    if (user?._id) {
      student = await Student.findOne({ user: user._id });
    }
    if (!student && studentId) {
      student = await Student.findOne({ $or: [{ _id: studentId }, { user: studentId }] });
    }

    let faculty = null;
    if (facultyId) {
      faculty = await Faculty.findOne({ $or: [{ _id: facultyId }, { user: facultyId }] });
    }

    if (!student || !faculty) {
      return true;
    }

    // 1. Check if Timetable has an explicit class link
    try {
      const timetableQuery = { faculty: faculty._id || facultyId };
      const orClauses = [];
      if (student.department) orClauses.push({ department: student.department });
      if (student.course) orClauses.push({ course: student.course });
      if (student.currentSemester) orClauses.push({ semester: student.currentSemester });

      if (orClauses.length > 0) {
        timetableQuery.$or = orClauses;
      }
      const link = await Timetable.findOne(timetableQuery);
      if (link) return true;
    } catch (e) {}

    // 2. Check Department matching
    if (student.department && faculty.department) {
      if (String(student.department) === String(faculty.department)) {
        return true;
      } else {
        // Different departments and no timetable class link -> Unrelated!
        return false;
      }
    }

    return true;
  } catch (err) {
    return true;
  }
}

/**
 * Helper to get faculty list associated with a student
 */
async function getStudentAssociatedFacultyList(studentId) {
  try {
    let student = null;
    if (typeof Student.findById === 'function') {
      const q = Student.findById(studentId);
      student = q && typeof q.lean === 'function' ? await q.lean() : await q;
    }
    if (!student && typeof Student.findOne === 'function') {
      const q = Student.findOne({ _id: studentId });
      student = q && typeof q.lean === 'function' ? await q.lean() : await q;
    }
    if (!student) return [];

    const facultyMap = new Map();

    // 1. From Timetable
    if (typeof Timetable.find === 'function') {
      const timetableQuery = {};
      if (student.department) timetableQuery.department = student.department;
      if (student.currentSemester) timetableQuery.semester = student.currentSemester;

      let slots = Timetable.find(timetableQuery)
        .populate({
          path: 'faculty',
          select: 'employeeId department designation qualification',
          populate: [
            { path: 'user', select: 'name email profileImage' },
            { path: 'department', select: 'name code' }
          ]
        })
        .populate('subject', 'name code credits');
      slots = typeof slots?.lean === 'function' ? await slots.lean() : await slots;

      if (Array.isArray(slots)) {
        for (const slot of slots) {
          if (!slot.faculty || !slot.faculty._id) continue;
          const fId = String(slot.faculty._id);
          if (!facultyMap.has(fId)) {
            facultyMap.set(fId, {
              _id: slot.faculty._id,
              employeeId: slot.faculty.employeeId,
              designation: slot.faculty.designation || 'Faculty Member',
              name: slot.faculty.user?.name || 'Faculty Member',
              email: slot.faculty.user?.email || '',
              department: slot.faculty.department?.name || 'Academic Department',
              departmentId: slot.faculty.department?._id || slot.faculty.department,
              subjects: []
            });
          }
          if (slot.subject && slot.subject._id) {
            const entry = facultyMap.get(fId);
            const subId = String(slot.subject._id);
            if (!entry.subjects.some((s) => String(s._id) === subId)) {
              entry.subjects.push({
                _id: slot.subject._id,
                name: slot.subject.name,
                code: slot.subject.code
              });
            }
          }
        }
      }
    }

    // 2. From Department
    if (student.department && typeof Faculty.find === 'function') {
      let deptFaculty = Faculty.find({ department: student.department })
        .populate('user', 'name email profileImage')
        .populate('department', 'name code');
      deptFaculty = typeof deptFaculty?.lean === 'function' ? await deptFaculty.lean() : await deptFaculty;

      if (Array.isArray(deptFaculty)) {
        for (const fac of deptFaculty) {
          if (!fac || !fac._id) continue;
          const fId = String(fac._id);
          if (!facultyMap.has(fId)) {
            facultyMap.set(fId, {
              _id: fac._id,
              employeeId: fac.employeeId,
              designation: fac.designation || 'Faculty Member',
              name: fac.user?.name || 'Faculty Member',
              email: fac.user?.email || '',
              department: fac.department?.name || 'Academic Department',
              departmentId: fac.department?._id || fac.department,
              subjects: []
            });
          }
        }
      }
    }

    return Array.from(facultyMap.values());
  } catch (err) {
    return [];
  }
}

/**
 * Get summary metrics for student appointments
 * GET /api/v1/student/appointments/summary
 */
async function getStudentAppointmentSummary(req, res, next) {
  try {
    const studentId = await getStudentDocId(req.user);
    const todayStr = new Date().toISOString().split('T')[0];

    const [total, pending, approved, upcoming, completed, cancelledOrRejected] = await Promise.all([
      Appointment.countDocuments({ student: studentId }),
      Appointment.countDocuments({ student: studentId, status: 'pending' }),
      Appointment.countDocuments({ student: studentId, status: { $in: ['approved', 'rescheduled'] } }),
      Appointment.countDocuments({
        student: studentId,
        status: { $in: ['approved', 'rescheduled'] },
        date: { $gte: todayStr }
      }),
      Appointment.countDocuments({ student: studentId, status: 'completed' }),
      Appointment.countDocuments({ student: studentId, status: { $in: ['cancelled', 'rejected'] } })
    ]);

    return sendSuccess(res, {
      message: 'Student appointment summary retrieved',
      data: {
        total,
        pending,
        approved,
        upcoming,
        completed,
        cancelledOrRejected
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get faculty members academically associated with the student
 * GET /api/v1/student/appointments/faculty
 */
async function getStudentAssociatedFaculty(req, res, next) {
  try {
    const studentId = await getStudentDocId(req.user);
    const facultyList = await getStudentAssociatedFacultyList(studentId);

    return sendSuccess(res, {
      message: 'Academically associated faculty members retrieved',
      data: facultyList
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get available slots for an associated faculty member on a given date
 * GET /api/v1/student/appointments/faculty/:facultyId/availability/:date/slots
 * GET /api/v1/student/appointments/faculty/:facultyId/availability
 */
async function getStudentFacultyAvailableSlots(req, res, next) {
  try {
    const studentId = await getStudentDocId(req.user);
    const { facultyId } = req.params;
    const dateStr = req.params.date || req.query.date || new Date().toISOString().split('T')[0];

    if (!facultyId) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Faculty ID is required',
        code: 'MISSING_FACULTY_ID'
      });
    }

    // Verify academic association
    const isAssociated = await checkFacultyStudentAssociation(facultyId, studentId);
    if (!isAssociated) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'You can only view availability for faculty members academically associated with your curriculum.',
        code: 'UNRELATED_FACULTY'
      });
    }

    const slots = await generateAvailableSlotsForDate({
      facultyId,
      dateStr
    });

    return sendSuccess(res, {
      message: 'Available consultation slots retrieved',
      data: {
        facultyId,
        date: dateStr,
        dayOfWeek: getDayOfWeek(dateStr),
        slots
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getFacultyAvailability,
  updateFacultyAvailability,
  getAvailableSlots,
  listFacultyAppointments,
  getFacultyAppointmentSummary,
  getFacultyCalendarAppointments,
  getAppointmentById,
  approveAppointment,
  rejectAppointment,
  rescheduleAppointment,
  cancelAppointment,
  completeAppointment,
  saveAppointmentNotes,
  createStudentAppointment,
  listStudentAppointments,
  getStudentAppointmentSummary,
  getStudentAssociatedFaculty,
  getStudentFacultyAvailableSlots
};
