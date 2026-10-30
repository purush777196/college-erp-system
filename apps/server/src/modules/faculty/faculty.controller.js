const Faculty = require('./faculty.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');
const Department = require('../departments/department.model');
const mongoose = require('mongoose');

async function listFaculty(req, res, next) {
  try {
    const query = {};
    if (req.query.department) query.department = req.query.department;
    if (req.query.designation) query.designation = req.query.designation;
    if (req.query.user) query.user = req.query.user;

    // Enforce HOD department-level scoping to ensure cross-department data isolation
    if (req.user?.role === ROLES.HOD && !query.department) {
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

    const facultyList = await Faculty.find(query)
      .populate('user', 'name email status role lastLogin')
      .populate('department', 'name code');

    return sendSuccess(res, {
      message: 'Faculty members retrieved successfully',
      data: facultyList,
      meta: { count: facultyList.length }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyFacultyProfile(req, res, next) {
  try {
    const faculty = await Faculty.findOne({ user: req.user._id })
      .populate('user', 'name email status role lastLogin')
      .populate('department', 'name code');

    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    return sendSuccess(res, { data: faculty });
  } catch (error) {
    next(error);
  }
}

async function getFacultyById(req, res, next) {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('user', 'name email status role lastLogin')
      .populate('department', 'name code');

    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Faculty record not found',
        code: 'NOT_FOUND'
      });
    }

    return sendSuccess(res, { data: faculty });
  } catch (error) {
    next(error);
  }
}

async function createFacultyProfile(req, res, next) {
  try {
    const { user, employeeId, department, designation, qualification, specialization } = req.body;

    const existing = await Faculty.findOne({ $or: [{ employeeId }, { user }] });
    if (existing) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Faculty profile already exists for this user or employee ID',
        code: 'DUPLICATE_RESOURCE'
      });
    }

    const faculty = await Faculty.create({
      user,
      employeeId,
      department,
      designation,
      qualification,
      specialization
    });

    await recordAuditLog({
      req,
      action: 'FACULTY_PROFILE_CREATED',
      entityType: 'Faculty',
      entityId: faculty._id,
      details: { employeeId: faculty.employeeId, designation: faculty.designation }
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Faculty profile created successfully',
      data: faculty
    });
  } catch (error) {
    next(error);
  }
}

async function updateFacultyProfile(req, res, next) {
  try {
    const { department, designation, qualification, specialization } = req.body;
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Faculty profile not found',
        code: 'NOT_FOUND'
      });
    }

    if (department) faculty.department = department;
    if (designation) faculty.designation = designation;
    if (qualification !== undefined) faculty.qualification = qualification;
    if (specialization !== undefined) faculty.specialization = specialization;

    await faculty.save();
    await faculty.populate('user', 'name email status role lastLogin');
    await faculty.populate('department', 'name code');

    await recordAuditLog({
      req,
      action: 'FACULTY_PROFILE_UPDATED',
      entityType: 'Faculty',
      entityId: faculty._id,
      details: { employeeId: faculty.employeeId, designation: faculty.designation }
    });

    return sendSuccess(res, {
      message: 'Faculty profile updated successfully',
      data: faculty
    });
  } catch (error) {
    next(error);
  }
}

async function getMyFacultyActivities(req, res, next) {
  try {
    const AuditLog = require('../audit-logs/audit.model');
    const logs = await AuditLog.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return sendSuccess(res, {
      message: 'Faculty recent activities retrieved successfully',
      data: logs,
      meta: { count: logs.length }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyAssignedSubjects(req, res, next) {
  try {
    const faculty = await Faculty.findOne({ user: req.user._id });
    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const Timetable = require('../timetable/timetable.model');
    const Subject = require('../subjects/subject.model');
    const Student = require('../students/student.model');
    const SyllabusProgress = require('../syllabus/syllabus.model');
    const { Assignment } = require('../assignments/assignment.model');

    // 1. Fetch timetable slots for this faculty
    const slots = await Timetable.find({ faculty: faculty._id })
      .populate({
        path: 'subject',
        populate: [
          { path: 'course', select: 'name code degreeType' },
          { path: 'department', select: 'name code' }
        ]
      })
      .populate('department', 'name code')
      .populate('course', 'name code degreeType');

    const subjectMap = new Map();

    for (const slot of slots) {
      if (!slot.subject) continue;
      const sub = slot.subject;
      const subIdStr = String(sub._id || sub.id);

      if (!subjectMap.has(subIdStr)) {
        subjectMap.set(subIdStr, {
          subject: sub,
          sections: new Set(),
          rooms: new Set(),
          slots: [],
          course: slot.course || sub.course,
          department: slot.department || sub.department,
          semester: slot.semester || sub.semester
        });
      }

      const entry = subjectMap.get(subIdStr);
      if (slot.section) entry.sections.add(slot.section);
      if (slot.roomNumber) entry.rooms.add(slot.roomNumber);
      entry.slots.push({
        _id: slot._id,
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber,
        section: slot.section
      });
    }

    // 2. Query any subjects tied to this faculty via Syllabus or Assignments
    const [progressRecords, assignmentRecords] = await Promise.all([
      SyllabusProgress.find({ faculty: faculty._id }).populate({
        path: 'subject',
        populate: [
          { path: 'course', select: 'name code degreeType' },
          { path: 'department', select: 'name code' }
        ]
      }),
      Assignment.find({ faculty: faculty._id }).populate({
        path: 'subject',
        populate: [
          { path: 'course', select: 'name code degreeType' },
          { path: 'department', select: 'name code' }
        ]
      })
    ]);

    for (const prog of progressRecords) {
      if (!prog.subject) continue;
      const sub = prog.subject;
      const subIdStr = String(sub._id || sub.id);
      if (!subjectMap.has(subIdStr)) {
        subjectMap.set(subIdStr, {
          subject: sub,
          sections: new Set(['A']),
          rooms: new Set(),
          slots: [],
          course: sub.course,
          department: sub.department,
          semester: sub.semester
        });
      }
    }

    for (const asgn of assignmentRecords) {
      if (!asgn.subject) continue;
      const sub = asgn.subject;
      const subIdStr = String(sub._id || sub.id);
      if (!subjectMap.has(subIdStr)) {
        subjectMap.set(subIdStr, {
          subject: sub,
          sections: new Set([asgn.section || 'A']),
          rooms: new Set(),
          slots: [],
          course: asgn.course || sub.course,
          department: asgn.department || sub.department,
          semester: asgn.semester || sub.semester
        });
      } else if (asgn.section) {
        subjectMap.get(subIdStr).sections.add(asgn.section);
      }
    }

    // 3. Transform and enrich each subject with cohort count, rooms, syllabus %
    const subjectList = [];

    for (const [subIdStr, entry] of subjectMap.entries()) {
      const sub = entry.subject;
      const deptId = entry.department?._id || sub.department?._id || sub.department;
      const courseId = entry.course?._id || sub.course?._id || sub.course;
      const semester = entry.semester || sub.semester;

      const studentFilter = {
        currentSemester: semester,
        admissionStatus: 'enrolled'
      };
      if (deptId) studentFilter.department = deptId;
      if (courseId) studentFilter.course = courseId;

      const [enrolledCount, syllabusProgress, assignmentsCount] = await Promise.all([
        Student.countDocuments(studentFilter),
        SyllabusProgress.findOne({ subject: sub._id, faculty: faculty._id }),
        Assignment.countDocuments({ subject: sub._id, faculty: faculty._id })
      ]);

      let syllabusCompletion = 0;
      let completedUnits = 0;
      let totalUnits = 5;
      if (syllabusProgress?.units?.length) {
        totalUnits = syllabusProgress.units.length;
        completedUnits = syllabusProgress.units.filter((u) => u.status === 'completed').length;
        syllabusCompletion = Math.round((completedUnits / totalUnits) * 100);
      }

      const sectionsArr = Array.from(entry.sections);
      if (sectionsArr.length === 0) sectionsArr.push('A');
      const roomsArr = Array.from(entry.rooms);

      subjectList.push({
        _id: sub._id,
        id: sub._id,
        code: sub.code,
        name: sub.name,
        semester,
        credits: sub.credits || 3,
        isLab: Boolean(sub.isLab),
        syllabusUrl: sub.syllabusUrl || '',
        department: entry.department || { name: 'Engineering', code: 'ENG' },
        course: entry.course || { name: 'B.Tech', code: 'BTECH' },
        sections: sectionsArr,
        section: sectionsArr.join(', '),
        rooms: roomsArr,
        roomNumber: roomsArr.length > 0 ? roomsArr.join(', ') : 'TBD',
        enrolledCount,
        weeklyLecturesCount: entry.slots.length,
        slots: entry.slots,
        syllabusCompletion,
        completedUnits,
        totalUnits,
        assignmentsCount,
        academicYear: '2025-26'
      });
    }

    let filteredList = subjectList;
    if (req.query.semester) {
      const semNum = Number(req.query.semester);
      if (!isNaN(semNum)) {
        filteredList = filteredList.filter((s) => Number(s.semester) === semNum);
      }
    }
    if (req.query.search) {
      const q = String(req.query.search).toLowerCase().trim();
      filteredList = filteredList.filter(
        (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    }

    return sendSuccess(res, {
      message: 'Assigned subjects retrieved successfully',
      data: filteredList,
      meta: { count: filteredList.length }
    });
  } catch (error) {
    next(error);
  }
}

async function getAssignedSubjectStudents(req, res, next) {
  try {
    const { subjectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid subject ID format',
        code: 'INVALID_ID'
      });
    }

    const faculty = await Faculty.findOne({ user: req.user._id });
    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const Timetable = require('../timetable/timetable.model');
    const Subject = require('../subjects/subject.model');
    const Student = require('../students/student.model');
    const Attendance = require('../attendance/attendance.model');
    const Result = require('../results/result.model');
    const SyllabusProgress = require('../syllabus/syllabus.model');
    const { Assignment } = require('../assignments/assignment.model');

    // Ownership check: Verify that this subject is assigned to this faculty
    const [timetableMatch, syllabusMatch, assignmentMatch] = await Promise.all([
      Timetable.findOne({ faculty: faculty._id, subject: subjectId }),
      SyllabusProgress.findOne({ faculty: faculty._id, subject: subjectId }),
      Assignment.findOne({ faculty: faculty._id, subject: subjectId })
    ]);

    const isAssigned = Boolean(timetableMatch || syllabusMatch || assignmentMatch);
    if (!isAssigned && req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.PRINCIPAL) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'You are not assigned to teach or manage this subject',
        code: 'NOT_ASSIGNED_TO_SUBJECT'
      });
    }

    const subject = await Subject.findById(subjectId)
      .populate('course', 'name code')
      .populate('department', 'name code');

    if (!subject) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Subject not found',
        code: 'NOT_FOUND'
      });
    }

    const studentQuery = {
      currentSemester: subject.semester,
      admissionStatus: 'enrolled'
    };
    if (subject.department?._id || subject.department) {
      studentQuery.department = subject.department._id || subject.department;
    }

    const students = await Student.find(studentQuery)
      .populate('user', 'name email status lastLogin')
      .populate('department', 'name code')
      .populate('course', 'name code')
      .sort({ rollNumber: 1 });

    const attendanceRecords = await Attendance.find({ subject: subject._id }).lean();
    const results = await Result.find({ subject: subject._id }).lean();

    const roster = students.map((st) => {
      const stIdStr = String(st._id);
      const stAtt = attendanceRecords.filter((r) => String(r.student) === stIdStr);
      const totalAtt = stAtt.length;
      const present = stAtt.filter((r) => r.status === 'present').length;
      const absent = stAtt.filter((r) => r.status === 'absent').length;
      const late = stAtt.filter((r) => r.status === 'late').length;
      const attPct = totalAtt > 0 ? Math.round(((present + late * 0.5) / totalAtt) * 100) : null;

      const stResult = results.find((r) => String(r.student) === stIdStr);

      return {
        _id: st._id,
        id: st._id,
        rollNumber: st.rollNumber,
        enrollmentNumber: st.enrollmentNumber,
        batchYear: st.batchYear,
        currentSemester: st.currentSemester,
        admissionStatus: st.admissionStatus,
        user: st.user,
        department: st.department,
        attendance: {
          totalClasses: totalAtt,
          present,
          absent,
          late,
          percentage: attPct
        },
        performance: {
          internalMarks: stResult?.internalMarks ?? null,
          externalMarks: stResult?.externalMarks ?? null,
          totalMarks: stResult?.totalMarks ?? null,
          grade: stResult?.grade ?? 'N/A'
        }
      };
    });

    return sendSuccess(res, {
      message: 'Enrolled students for assigned subject retrieved successfully',
      data: {
        subject: {
          _id: subject._id,
          code: subject.code,
          name: subject.name,
          semester: subject.semester,
          credits: subject.credits,
          department: subject.department,
          course: subject.course
        },
        students: roster,
        meta: {
          totalStudents: roster.length,
          totalAttendanceRecords: attendanceRecords.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listFaculty,
  getFacultyById,
  getMyFacultyProfile,
  getMyFacultyActivities,
  getMyAssignedSubjects,
  getAssignedSubjectStudents,
  createFacultyProfile,
  updateFacultyProfile
};
