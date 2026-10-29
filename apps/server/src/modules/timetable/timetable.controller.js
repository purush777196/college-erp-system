const Timetable = require('./timetable.model');
const Department = require('../departments/department.model');
const Student = require('../students/student.model');
const Faculty = require('../faculty/faculty.model');
const mongoose = require('mongoose');
const { ROLES } = require('@college-erp/shared');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS } = require('@college-erp/shared');

async function getTimetable(req, res, next) {
  try {
    const query = {};
    if (req.query.department) {
      const deptVal = String(req.query.department).trim();
      if (deptVal && deptVal !== '[object Object]') {
        if (mongoose.Types.ObjectId.isValid(deptVal)) {
          query.department = deptVal;
        } else {
          const foundDept = await Department.findOne({
            $or: [{ code: deptVal.toUpperCase() }, { name: deptVal }]
          });
          if (foundDept) {
            query.department = foundDept._id;
          } else {
            return sendError(res, {
              statusCode: HTTP_STATUS.BAD_REQUEST,
              message: `Department '${deptVal}' not found`,
              code: 'INVALID_DEPARTMENT'
            });
          }
        }
      }
    }
    if (req.query.course) {
      const cVal = String(req.query.course).trim();
      if (mongoose.Types.ObjectId.isValid(cVal)) query.course = cVal;
    }
    if (req.query.faculty) {
      const fVal = String(req.query.faculty).trim();
      if (mongoose.Types.ObjectId.isValid(fVal)) query.faculty = fVal;
    }
    if (req.query.semester) {
      const sem = parseInt(req.query.semester, 10);
      if (!isNaN(sem)) query.semester = sem;
    }
    if (req.query.section && typeof req.query.section === 'string') {
      query.section = req.query.section.toUpperCase();
    }
    if (req.query.dayOfWeek && typeof req.query.dayOfWeek === 'string') {
      query.dayOfWeek = req.query.dayOfWeek;
    }

    if (req.user && req.user.role === ROLES.STUDENT && !query.department) {
      const studentProfile = await Student.findOne({ user: req.user._id });
      if (studentProfile) {
        if (studentProfile.department) query.department = studentProfile.department;
        if (studentProfile.currentSemester) query.semester = studentProfile.currentSemester;
      }
    } else if (req.user && req.user.role === ROLES.FACULTY && !query.faculty) {
      const facultyProfile = await Faculty.findOne({ user: req.user._id });
      if (facultyProfile) query.faculty = facultyProfile._id;
    } else if (req.user && req.user.role === ROLES.HOD) {
      const dept = await Department.findOne({
        $or: [
          { hod: req.user._id },
          ...(req.user.department
            ? [
                ...(mongoose.Types.ObjectId.isValid(req.user.department) ? [{ _id: req.user.department }] : []),
                { name: req.user.department },
                { code: String(req.user.department).toUpperCase() }
              ]
            : [])
        ]
      });
      if (dept) query.department = dept._id;
    }

    const slots = await Timetable.find(query)
      .populate('subject', 'name code credits isLab')
      .populate({
        path: 'faculty',
        select: 'employeeId designation qualification',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('department', 'name code')
      .populate('course', 'name code degreeType')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    return sendSuccess(res, {
      message: 'Timetable retrieved successfully',
      data: slots,
      meta: { count: slots.length, isScaffold: false }
    });
  } catch (error) {
    next(error);
  }
}

async function checkTimetableConflicts({ dayOfWeek, periodNumber, roomNumber, faculty, department, semester, section, excludeId = null }) {
  const baseFilter = {
    dayOfWeek,
    periodNumber: Number(periodNumber)
  };
  if (excludeId) {
    baseFilter._id = { $ne: excludeId };
  }

  // 1. Check Faculty Clash
  if (faculty) {
    const facultyConflict = await Timetable.findOne({
      ...baseFilter,
      faculty
    }).populate('subject', 'name code');
    if (facultyConflict) {
      return `Faculty conflict: This instructor is already scheduled for ${facultyConflict.subject?.code || 'another class'} during ${dayOfWeek} Period ${periodNumber}.`;
    }
  }

  // 2. Check Classroom / Lab Clash
  if (roomNumber && roomNumber.trim()) {
    const roomConflict = await Timetable.findOne({
      ...baseFilter,
      roomNumber: roomNumber.trim()
    }).populate('subject', 'name code');
    if (roomConflict) {
      return `Room conflict: Room/Lab '${roomNumber.trim()}' is already booked for ${roomConflict.subject?.code || 'another class'} during ${dayOfWeek} Period ${periodNumber}.`;
    }
  }

  // 3. Check Section / Class Clash
  if (department && semester && section) {
    const sectionConflict = await Timetable.findOne({
      ...baseFilter,
      department,
      semester: Number(semester),
      section: section.toUpperCase()
    }).populate('subject', 'name code');
    if (sectionConflict) {
      return `Section conflict: Semester ${semester} Section ${section.toUpperCase()} already has a class scheduled during ${dayOfWeek} Period ${periodNumber}.`;
    }
  }

  return null;
}

async function createTimetableSlot(req, res, next) {
  try {
    const { department, course, semester, section = 'A', dayOfWeek, periodNumber, startTime, endTime, subject, faculty, roomNumber } = req.body;

    const conflictError = await checkTimetableConflicts({
      dayOfWeek,
      periodNumber,
      roomNumber,
      faculty,
      department,
      semester,
      section
    });

    if (conflictError) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: conflictError,
        code: 'SCHEDULE_CONFLICT'
      });
    }

    const slot = await Timetable.create({
      department,
      course,
      semester: Number(semester),
      section: (section || 'A').toUpperCase().trim(),
      dayOfWeek,
      periodNumber: Number(periodNumber),
      startTime,
      endTime,
      subject,
      faculty,
      roomNumber: (roomNumber || '').trim()
    });

    const populated = await Timetable.findById(slot._id)
      .populate('subject', 'name code credits')
      .populate({
        path: 'faculty',
        select: 'employeeId designation',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('department', 'name code');

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Timetable slot created successfully',
      data: populated
    });
  } catch (error) {
    next(error);
  }
}

async function updateTimetableSlot(req, res, next) {
  try {
    const slot = await Timetable.findById(req.params.id);
    if (!slot) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Timetable slot not found',
        code: 'NOT_FOUND'
      });
    }

    const { department, course, semester, section, dayOfWeek, periodNumber, startTime, endTime, subject, faculty, roomNumber } = req.body;

    const conflictError = await checkTimetableConflicts({
      dayOfWeek: dayOfWeek || slot.dayOfWeek,
      periodNumber: periodNumber !== undefined ? periodNumber : slot.periodNumber,
      roomNumber: roomNumber !== undefined ? roomNumber : slot.roomNumber,
      faculty: faculty || slot.faculty,
      department: department || slot.department,
      semester: semester !== undefined ? semester : slot.semester,
      section: section || slot.section,
      excludeId: slot._id
    });

    if (conflictError) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: conflictError,
        code: 'SCHEDULE_CONFLICT'
      });
    }

    if (department) slot.department = department;
    if (course) slot.course = course;
    if (semester !== undefined) slot.semester = Number(semester);
    if (section) slot.section = section.toUpperCase().trim();
    if (dayOfWeek) slot.dayOfWeek = dayOfWeek;
    if (periodNumber !== undefined) slot.periodNumber = Number(periodNumber);
    if (startTime) slot.startTime = startTime;
    if (endTime) slot.endTime = endTime;
    if (subject) slot.subject = subject;
    if (faculty) slot.faculty = faculty;
    if (roomNumber !== undefined) slot.roomNumber = roomNumber.trim();

    await slot.save();

    const populated = await Timetable.findById(slot._id)
      .populate('subject', 'name code credits')
      .populate({
        path: 'faculty',
        select: 'employeeId designation',
        populate: { path: 'user', select: 'name email' }
      })
      .populate('department', 'name code');

    return sendSuccess(res, {
      message: 'Timetable slot updated successfully',
      data: populated
    });
  } catch (error) {
    next(error);
  }
}

async function deleteTimetableSlot(req, res, next) {
  try {
    const slot = await Timetable.findByIdAndDelete(req.params.id);
    if (!slot) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Timetable slot not found',
        code: 'NOT_FOUND'
      });
    }

    return sendSuccess(res, {
      message: 'Timetable slot cancelled/removed successfully',
      data: { id: req.params.id }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTimetable,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot
};
