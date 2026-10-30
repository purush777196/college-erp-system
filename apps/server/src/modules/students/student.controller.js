const Student = require('./student.model');
const Department = require('../departments/department.model');
const Faculty = require('../faculty/faculty.model');
const User = require('../auth/auth.model');
const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');

async function listStudents(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.department) {
      const deptVal = String(req.query.department).trim();
      if (deptVal === '[object Object]' || deptVal === 'undefined' || deptVal === 'null') {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid department identifier supplied',
          code: 'INVALID_DEPARTMENT'
        });
      }
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
            message: `Department '${deptVal}' not found or invalid format`,
            code: 'INVALID_DEPARTMENT'
          });
        }
      }
    } else if (req.user?.role === ROLES.HOD) {
      // Enforce HOD department-level scoping to ensure cross-department data isolation
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
    } else if (mongoose.connection.readyState === 1 && req.user?.role === ROLES.FACULTY && !req.query.department) {
      const facProfile = await Faculty.findOne({ user: req.user._id });
      if (facProfile && facProfile.department) {
        query.department = facProfile.department;
      }
    }

    if (req.query.course) {
      const cVal = String(req.query.course).trim();
      if (mongoose.Types.ObjectId.isValid(cVal)) {
        query.course = cVal;
      }
    }
    if (req.query.semester) query.currentSemester = parseInt(req.query.semester, 10);
    if (req.query.batch) query.batchYear = req.query.batch;
    if (req.query.status) query.admissionStatus = req.query.status;

    if (req.query.q && typeof req.query.q === 'string' && req.query.q.trim()) {
      const regex = new RegExp(req.query.q.trim(), 'i');
      query.$or = [{ rollNumber: regex }, { enrollmentNumber: regex }];
      if (mongoose.connection.readyState === 1) {
        const matchingUsers = await User.find({ name: regex, role: ROLES.STUDENT }).select('_id');
        const userIds = matchingUsers.map((u) => u._id);
        if (userIds.length > 0) {
          query.$or.push({ user: { $in: userIds } });
        }
      }
    }

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate('user', 'name email status lastLogin')
        .populate('department', 'name code')
        .populate('course', 'name code')
        .skip(skip)
        .limit(limit)
        .sort({ rollNumber: 1 }),
      Student.countDocuments(query)
    ]);

    return sendSuccess(res, {
      message: 'Students retrieved successfully',
      data: students,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getStudentById(req, res, next) {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', 'name email status lastLogin')
      .populate('department', 'name code')
      .populate('course', 'name code');

    if (!student) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Student record not found',
        code: 'NOT_FOUND'
      });
    }

    return sendSuccess(res, { data: student });
  } catch (error) {
    next(error);
  }
}

async function getMyStudentProfile(req, res, next) {
  try {
    const student = await Student.findOne({ user: req.user._id })
      .populate('user', 'name email status lastLogin')
      .populate('department', 'name code')
      .populate('course', 'name code');

    if (!student) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No student profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    return sendSuccess(res, { data: student });
  } catch (error) {
    next(error);
  }
}

async function createStudentProfile(req, res, next) {
  try {
    const { user, rollNumber, enrollmentNumber, department, course, currentSemester, batchYear, guardianName, guardianPhone, admissionStatus } = req.body;

    const existing = await Student.findOne({ $or: [{ rollNumber }, { user }] });
    if (existing) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Student profile already exists with this user or roll number',
        code: 'DUPLICATE_RESOURCE'
      });
    }

    const student = await Student.create({
      user,
      rollNumber,
      enrollmentNumber,
      department,
      course,
      currentSemester: currentSemester || 1,
      batchYear,
      guardianName,
      guardianPhone,
      admissionStatus: admissionStatus || 'enrolled'
    });

    await recordAuditLog({
      req,
      action: 'STUDENT_PROFILE_CREATED',
      entityType: 'Student',
      entityId: student._id,
      details: { rollNumber: student.rollNumber, semester: student.currentSemester }
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Student profile created successfully',
      data: student
    });
  } catch (error) {
    next(error);
  }
}

async function updateStudentProfile(req, res, next) {
  try {
    const { department, course, currentSemester, batchYear, guardianName, guardianPhone, admissionStatus } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Student profile not found',
        code: 'NOT_FOUND'
      });
    }

    if (department) student.department = department;
    if (course) student.course = course;
    if (currentSemester !== undefined) student.currentSemester = currentSemester;
    if (batchYear) student.batchYear = batchYear;
    if (guardianName !== undefined) student.guardianName = guardianName;
    if (guardianPhone !== undefined) student.guardianPhone = guardianPhone;
    if (admissionStatus) student.admissionStatus = admissionStatus;

    await student.save();
    await student.populate('user', 'name email status lastLogin');
    await student.populate('department', 'name code');
    await student.populate('course', 'name code');

    await recordAuditLog({
      req,
      action: 'STUDENT_PROFILE_UPDATED',
      entityType: 'Student',
      entityId: student._id,
      details: { rollNumber: student.rollNumber, semester: student.currentSemester, status: student.admissionStatus }
    });

    return sendSuccess(res, {
      message: 'Student profile updated successfully',
      data: student
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listStudents,
  getStudentById,
  getMyStudentProfile,
  createStudentProfile,
  updateStudentProfile
};
