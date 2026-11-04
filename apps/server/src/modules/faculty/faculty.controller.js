const Faculty = require('./faculty.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');
const { resolveHodDepartment, isHodDepartment } = require('../../utils/hodScoping');
const Department = require('../departments/department.model');
const Timetable = require('../timetable/timetable.model');
const Subject = require('../subjects/subject.model');
const Student = require('../students/student.model');
const Attendance = require('../attendance/attendance.model');
const Leave = require('../leave/leave.model');
const User = require('../auth/auth.model');
const mongoose = require('mongoose');

/**
 * Calculate working days between two dates, excluding Sundays
 */
function calculateWorkingDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  let count = 0;
  const cur = new Date(startDate);
  const end = new Date(endDate);
  cur.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  if (cur > end) return 1;

  while (cur <= end) {
    const dayOfWeek = cur.getUTCDay(); // 0 is Sunday
    if (dayOfWeek !== 0) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(1, count);
}

/**
 * Retrieve comprehensive, database-driven dashboard KPI statistics for authenticated faculty
 */
async function getFacultyDashboardStats(req, res, next) {
  try {
    let facultyUserId = req.user._id;

    // Optional query overrides for admin/principal/hod looking at a specific faculty
    if (req.query.user && [ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD].includes(req.user.role)) {
      facultyUserId = req.query.user;
    }

    // 1. Resolve Faculty profile
    let facultyProfile = await Faculty.findOne({ user: facultyUserId })
      .populate('department', 'name code')
      .populate('user', 'name email status role leaveBalance leaveEntitlement');

    if (!facultyProfile && req.query.faculty && [ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD].includes(req.user.role)) {
      if (mongoose.Types.ObjectId.isValid(req.query.faculty)) {
        facultyProfile = await Faculty.findById(req.query.faculty)
          .populate('department', 'name code')
          .populate('user', 'name email status role leaveBalance leaveEntitlement');
        if (facultyProfile?.user?._id) {
          facultyUserId = facultyProfile.user._id;
        }
      }
    }

    // If profile is missing (e.g. newly registered user without profile yet)
    if (!facultyProfile) {
      return sendSuccess(res, {
        message: 'Faculty profile not found; baseline zero metrics returned',
        data: {
          isProfileMissing: true,
          totalStudentsTaught: 0,
          assignedSubjects: 0,
          weeklyClasses: 0,
          classAttendance: {
            percentage: null,
            present: 0,
            absent: 0,
            total: 0,
            hasRecords: false
          },
          leaveBalance: {
            entitlement: 12,
            approvedDays: 0,
            remaining: 12,
            pendingCount: 0
          },
          details: {
            students: [],
            assignedSubjects: [],
            weeklySchedule: [],
            assignedSubjectList: [],
            timetableSlotCount: 0,
            enrolledStudentCount: 0
          }
        }
      });
    }

    const facultyDocId = facultyProfile._id;
    const facultyUserObj = facultyProfile.user || req.user;

    // 2. Timetable & Assigned Subjects
    // Query slots matching faculty doc ID or faculty user ID
    const timetableSlots = await Timetable.find({
      faculty: { $in: [facultyDocId, facultyUserId] }
    }).populate('subject', 'name code semester credits isLab');

    // Deduplicate weekly scheduled class slots by (dayOfWeek, periodNumber)
    const uniqueSlotKeySet = new Set();
    timetableSlots.forEach((slot) => {
      if (slot.dayOfWeek && slot.periodNumber) {
        uniqueSlotKeySet.add(`${slot.dayOfWeek}-${slot.periodNumber}`);
      }
    });
    const weeklyClassesCount = uniqueSlotKeySet.size || timetableSlots.length;

    // Assigned Subjects: Distinct subjects from timetable
    const timetableSubjectMap = new Map();
    timetableSlots.forEach((slot) => {
      if (slot.subject && (slot.subject._id || slot.subject.id)) {
        const subId = (slot.subject._id || slot.subject.id).toString();
        if (!timetableSubjectMap.has(subId)) {
          timetableSubjectMap.set(subId, slot.subject);
        }
      }
    });

    let assignedSubjectList = Array.from(timetableSubjectMap.values());

    // If no timetable slots scheduled yet, fallback to curriculum subjects in faculty's department
    if (assignedSubjectList.length === 0 && facultyProfile.department?._id) {
      const deptSubjects = await Subject.find({ department: facultyProfile.department._id });
      assignedSubjectList = deptSubjects;
    }

    const assignedSubjectsCount = assignedSubjectList.length;

    // 3. Distinct Students Taught
    // Identify semesters and departments of assigned subjects
    const assignedSubjectSemesters = [
      ...new Set(assignedSubjectList.map((s) => s.semester).filter((sem) => sem !== undefined && sem !== null))
    ];

    const studentQuery = {
      department: facultyProfile.department?._id || facultyProfile.department,
      admissionStatus: { $ne: 'withdrawn' }
    };
    if (assignedSubjectSemesters.length > 0) {
      studentQuery.currentSemester = { $in: assignedSubjectSemesters };
    }

    const enrolledStudents = await Student.find(studentQuery)
      .populate('user', 'name email status')
      .populate('department', 'name code')
      .select('_id rollNumber enrollmentNumber currentSemester department user');

    // Also include any distinct students who have attendance marked by this faculty
    const attendanceStudentIds = await Attendance.distinct('student', {
      faculty: { $in: [facultyDocId, facultyUserId] }
    });

    const distinctStudentIdSet = new Set();
    enrolledStudents.forEach((st) => distinctStudentIdSet.add(st._id.toString()));
    attendanceStudentIds.forEach((stId) => distinctStudentIdSet.add(stId.toString()));

    const totalStudentsTaughtCount = distinctStudentIdSet.size;

    // Detailed distinct student records with assigned subject details
    const studentsDetailsList = enrolledStudents.map((st) => {
      const matchingSubs = assignedSubjectList.filter(
        (sub) => !sub.semester || Number(st.currentSemester) === Number(sub.semester)
      );
      return {
        _id: st._id,
        name: st.user?.name || 'Student',
        email: st.user?.email || '',
        rollNumber: st.rollNumber,
        enrollmentNumber: st.enrollmentNumber || st.rollNumber,
        department: st.department?.name || facultyProfile.department?.name || 'Computer Science & Engineering',
        departmentCode: st.department?.code || facultyProfile.department?.code || 'CSE',
        currentSemester: st.currentSemester,
        assignedSubjects: matchingSubs.map((s) => ({
          id: s._id,
          name: s.name,
          code: s.code,
          credits: s.credits
        }))
      };
    });

    // Detailed assigned subjects with associated scheduled class times
    const assignedSubjectsDetails = assignedSubjectList.map((sub) => {
      const subSlots = timetableSlots.filter((slot) => {
        const slotSubId = (slot.subject?._id || slot.subject?.id || slot.subject)?.toString();
        return slotSubId === (sub._id || sub.id)?.toString();
      });
      return {
        _id: sub._id,
        name: sub.name,
        code: sub.code,
        department: sub.department?.name || facultyProfile.department?.name || 'Computer Science & Engineering',
        semester: sub.semester,
        credits: sub.credits || 3,
        isLab: Boolean(sub.isLab),
        classes: subSlots.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          periodNumber: s.periodNumber,
          startTime: s.startTime,
          endTime: s.endTime,
          roomNumber: s.roomNumber || 'LH-101',
          section: s.section || 'A'
        }))
      };
    });

    // Detailed weekly teaching schedule sorted by weekday and period
    const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const weeklyScheduleDetails = timetableSlots
      .map((s) => ({
        _id: s._id,
        dayOfWeek: s.dayOfWeek,
        periodNumber: s.periodNumber,
        startTime: s.startTime,
        endTime: s.endTime,
        roomNumber: s.roomNumber || 'LH-101',
        semester: s.semester,
        section: s.section || 'A',
        subject: {
          id: s.subject?._id,
          name: s.subject?.name || 'Curriculum Subject',
          code: s.subject?.code || 'N/A'
        }
      }))
      .sort((a, b) => {
        const dDiff = (dayOrder[a.dayOfWeek] || 7) - (dayOrder[b.dayOfWeek] || 7);
        if (dDiff !== 0) return dDiff;
        return a.periodNumber - b.periodNumber;
      });

    // 4. Class Attendance Percentage
    // Formula: (Present Students / Total Attendance Records) * 100
    const attendanceRecords = await Attendance.find({
      faculty: { $in: [facultyDocId, facultyUserId] }
    });

    const totalAttendanceRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
    const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;
    const hasAttendanceRecords = totalAttendanceRecords > 0;
    const attendancePercentage = hasAttendanceRecords
      ? Math.round((presentCount / totalAttendanceRecords) * 100)
      : null;

    // 5. Leave Balance
    // Entitlement configured on user/faculty, default 12
    const configuredEntitlement =
      typeof facultyUserObj.leaveEntitlement === 'number' && facultyUserObj.leaveEntitlement >= 0
        ? facultyUserObj.leaveEntitlement
        : typeof facultyProfile.leaveEntitlement === 'number' && facultyProfile.leaveEntitlement >= 0
        ? facultyProfile.leaveEntitlement
        : typeof facultyUserObj.leaveBalance === 'number' && facultyUserObj.leaveBalance >= 0
        ? facultyUserObj.leaveBalance
        : 12;

    const [approvedLeaves, pendingLeaves] = await Promise.all([
      Leave.find({
        user: facultyUserId,
        status: 'approved'
      }),
      Leave.find({
        user: facultyUserId,
        status: 'pending'
      })
    ]);

    // Calculate approved days taken, respecting working days (weekends excluded)
    const approvedDaysTaken = approvedLeaves.reduce((sum, leaveDoc) => {
      const workingDays = calculateWorkingDays(leaveDoc.startDate, leaveDoc.endDate);
      const effectiveDays = leaveDoc.numberOfDays ? Math.min(leaveDoc.numberOfDays, workingDays) : workingDays;
      return sum + effectiveDays;
    }, 0);

    const remainingLeaveBalance = Math.max(0, configuredEntitlement - approvedDaysTaken);

    return sendSuccess(res, {
      message: 'Faculty dashboard statistics calculated successfully',
      data: {
        isProfileMissing: false,
        totalStudentsTaught: totalStudentsTaughtCount,
        assignedSubjects: assignedSubjectsCount,
        weeklyClasses: weeklyClassesCount,
        classAttendance: {
          percentage: attendancePercentage,
          present: presentCount,
          absent: absentCount,
          total: totalAttendanceRecords,
          hasRecords: hasAttendanceRecords
        },
        leaveBalance: {
          entitlement: configuredEntitlement,
          approvedDays: approvedDaysTaken,
          remaining: remainingLeaveBalance,
          pendingCount: pendingLeaves.length
        },
        details: {
          students: studentsDetailsList,
          assignedSubjects: assignedSubjectsDetails,
          weeklySchedule: weeklyScheduleDetails,
          assignedSubjectList: assignedSubjectList.map((s) => ({
            id: s._id,
            name: s.name,
            code: s.code,
            semester: s.semester
          })),
          timetableSlotCount: weeklyClassesCount,
          enrolledStudentCount: totalStudentsTaughtCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

async function listFaculty(req, res, next) {
  try {
    const query = {};
    if (req.query.department) query.department = req.query.department;
    if (req.query.designation) query.designation = req.query.designation;
    if (req.query.user) query.user = req.query.user;

    // Enforce HOD department-level scoping to ensure cross-department data isolation
    if (req.user?.role === ROLES.HOD) {
      const dept = await resolveHodDepartment(req.user);
      if (dept) {
        if (req.query.department) {
          const matches = await isHodDepartment(req.user, req.query.department);
          if (!matches) {
            return sendError(res, {
              statusCode: HTTP_STATUS.FORBIDDEN,
              message: 'Forbidden: HOD can only view faculty within their assigned department',
              code: 'FORBIDDEN'
            });
          }
        }
        query.department = dept._id;
      }
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

    if (req.user?.role === ROLES.HOD && department) {
      const matches = await isHodDepartment(req.user, department);
      if (!matches) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Forbidden: HOD can only create faculty profiles within their assigned department',
          code: 'FORBIDDEN'
        });
      }
    }

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

    if (req.user?.role === ROLES.HOD && faculty.department) {
      const matches = await isHodDepartment(req.user, faculty.department);
      if (!matches) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Forbidden: HOD can only update faculty profiles within their assigned department',
          code: 'FORBIDDEN'
        });
      }
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

module.exports = {
  listFaculty,
  getFacultyById,
  getMyFacultyProfile,
  createFacultyProfile,
  updateFacultyProfile,
  getFacultyDashboardStats
};
