const Attendance = require('./attendance.model');
const Student = require('../students/student.model');
const Department = require('../departments/department.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');

async function getAttendanceRecords(req, res, next) {
  try {
    const query = {};
    if (req.query.student) query.student = req.query.student;
    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.date) query.date = new Date(req.query.date);

    // If student role, restrict query to self
    if (req.user.role === ROLES.STUDENT) {
      const studentProfile = await Student.findOne({ user: req.user._id });
      if (!studentProfile) {
        return sendError(res, {
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Student profile not linked to user account',
          code: 'PROFILE_NOT_FOUND'
        });
      }
      query.student = studentProfile._id;
    } else if (req.user && req.user.role === ROLES.HOD && !req.query.student) {
      let hodDept = null;
      if (req.user.department) {
        hodDept = await Department.findOne({
          $or: [{ name: req.user.department }, { hod: req.user._id }]
        });
      } else {
        hodDept = await Department.findOne({ hod: req.user._id });
      }

      if (hodDept) {
        const deptStudents = await Student.find({ department: hodDept._id }).select('_id');
        const deptStudentIds = deptStudents.map((s) => s._id);
        query.student = { $in: deptStudentIds };
      }
    }

    const records = await Attendance.find(query)
      .populate('student', 'rollNumber')
      .populate('subject', 'name code')
      .limit(100)
      .sort({ date: -1 });

    return sendSuccess(res, {
      message: 'Attendance records fetched successfully',
      data: records,
      meta: { count: records.length }
    });
  } catch (error) {
    next(error);
  }
}

async function markAttendanceBatch(req, res, next) {
  try {
    const { subject, date, periodNumber = 1, records } = req.body;

    const operations = records.map((rec) => ({
      updateOne: {
        filter: {
          student: rec.studentId,
          subject,
          date: new Date(date),
          periodNumber
        },
        update: {
          $set: {
            status: rec.status,
            remarks: rec.remarks || '',
            faculty: req.user._id
          }
        },
        upsert: true
      }
    }));

    const result = await Attendance.bulkWrite(operations);

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Attendance recorded successfully',
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAttendanceSummary(req, res, next) {
  try {
    let studentId = req.query.studentId || req.query.student;
    const departmentId = req.query.departmentId || req.query.department;

    if (req.user.role === ROLES.STUDENT) {
      const profile = await Student.findOne({ user: req.user._id });
      if (!profile) {
        return sendError(res, {
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Student profile not found',
          code: 'NOT_FOUND'
        });
      }
      studentId = profile._id;
    }

    let query = {};
    let totalDepartmentStudents = 0;

    if (departmentId) {
      const deptStudents = await Student.find({ department: departmentId }).select('_id');
      totalDepartmentStudents = deptStudents.length;
      const studentIds = deptStudents.map((s) => s._id);
      query.student = { $in: studentIds };
    } else if (studentId) {
      query.student = studentId;
    }

    if (req.query.subject) {
      query.subject = req.query.subject;
    }

    const records = await Attendance.find(query);
    const totalClasses = records.length;
    const presentClasses = records.filter((r) => r.status === 'present').length;
    const absentClasses = records.filter((r) => r.status === 'absent').length;
    const percentage = totalClasses > 0 ? Number(((presentClasses / totalClasses) * 100).toFixed(1)) : 0;

    return sendSuccess(res, {
      message: 'Attendance summary calculated',
      data: {
        totalClasses,
        presentClasses,
        absentClasses,
        percentage,
        totalDepartmentStudents,
        hasRecords: totalClasses > 0,
        statusAlert: totalClasses === 0 ? 'No attendance records yet' : percentage < 75 ? 'Low Attendance (<75%)' : 'Good Standing (≥75%)'
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAttendanceRecords,
  markAttendanceBatch,
  getAttendanceSummary
};

