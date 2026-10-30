const Result = require('./result.model');
const Examination = require('../examinations/exam.model');
const Student = require('../students/student.model');
const Department = require('../departments/department.model');
const mongoose = require('mongoose');
const { recordAuditLog } = require('../../utils/auditLogger');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');

async function getResults(req, res, next) {
  try {
    const query = {};
    if (req.query.examination) query.examination = req.query.examination;
    if (req.query.student) query.student = req.query.student;
    if (req.query.subject) query.subject = req.query.subject;

    // Security invariant: Students can ONLY query their own results AND only for published exams!
    if (req.user.role === ROLES.STUDENT) {
      const profile = await Student.findOne({ user: req.user._id });
      if (!profile) {
        return sendError(res, {
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Student profile not linked',
          code: 'PROFILE_NOT_FOUND'
        });
      }
      query.student = profile._id;

      // Find published exams only
      const publishedExams = await Examination.find({ isPublished: true }).select('_id');
      const publishedExamIds = publishedExams.map((e) => e._id);
      query.examination = { $in: publishedExamIds };
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

    const results = await Result.find(query)
      .populate('examination', 'name examType academicYear semester isPublished status')
      .populate('subject', 'name code credits isLab')
      .populate({
        path: 'student',
        select: 'rollNumber enrollmentNumber batchYear currentSemester',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ createdAt: -1 });

    return sendSuccess(res, {
      message: 'Examination results retrieved successfully',
      data: results,
      meta: { count: results.length }
    });
  } catch (error) {
    next(error);
  }
}

async function recordResult(req, res, next) {
  try {
    const { examination, student, subject, internalMarks = 0, externalMarks = 0, status: submittedStatus } = req.body;

    const numInternal = Number(internalMarks);
    const numExternal = Number(externalMarks);

    // Enforce strict marks boundary checks: Reject negative marks and marks exceeding maximums
    if (numInternal < 0 || numInternal > 40) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Internal marks must be between 0 and 40',
        code: 'MARKS_OUT_OF_BOUNDS'
      });
    }

    if (numExternal < 0 || numExternal > 60) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'External marks must be between 0 and 60',
        code: 'MARKS_OUT_OF_BOUNDS'
      });
    }

    const totalMarks = numInternal + numExternal;

    let grade = 'F';
    let status = 'failed';
    if (totalMarks >= 90) { grade = 'O'; status = 'passed'; }
    else if (totalMarks >= 80) { grade = 'A+'; status = 'passed'; }
    else if (totalMarks >= 70) { grade = 'A'; status = 'passed'; }
    else if (totalMarks >= 60) { grade = 'B+'; status = 'passed'; }
    else if (totalMarks >= 50) { grade = 'B'; status = 'passed'; }
    else if (totalMarks >= 40) { grade = 'C'; status = 'passed'; }

    if (submittedStatus === 'absent' || submittedStatus === 'withheld') {
      status = submittedStatus;
      grade = submittedStatus === 'absent' ? 'AB' : 'F';
    }

    const result = await Result.findOneAndUpdate(
      { examination, student, subject },
      { internalMarks: numInternal, externalMarks: numExternal, totalMarks, grade, status },
      { upsert: true, new: true, runValidators: true }
    )
      .populate('examination', 'name examType academicYear')
      .populate('subject', 'name code credits')
      .populate({
        path: 'student',
        select: 'rollNumber',
        populate: { path: 'user', select: 'name' }
      });

    await recordAuditLog({
      req,
      action: 'MARKS_RECORDED',
      entityType: 'Result',
      entityId: String(result._id || subject),
      details: { examination, subject, student, totalMarks, grade, status }
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Marks entered and grade computed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function batchRecordResults(req, res, next) {
  try {
    const { examination, subject, records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Records array is required for batch marks entry',
        code: 'INVALID_PAYLOAD'
      });
    }

    const operations = [];
    for (const rec of records) {
      const numInternal = Number(rec.internalMarks || 0);
      const numExternal = Number(rec.externalMarks || 0);

      if (numInternal < 0 || numInternal > 40 || numExternal < 0 || numExternal > 60) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: `Marks out of bounds for student ${rec.studentId}: Internal 0-40, External 0-60`,
          code: 'MARKS_OUT_OF_BOUNDS'
        });
      }

      const totalMarks = numInternal + numExternal;
      let grade = 'F';
      let status = 'failed';
      if (totalMarks >= 90) { grade = 'O'; status = 'passed'; }
      else if (totalMarks >= 80) { grade = 'A+'; status = 'passed'; }
      else if (totalMarks >= 70) { grade = 'A'; status = 'passed'; }
      else if (totalMarks >= 60) { grade = 'B+'; status = 'passed'; }
      else if (totalMarks >= 50) { grade = 'B'; status = 'passed'; }
      else if (totalMarks >= 40) { grade = 'C'; status = 'passed'; }

      operations.push({
        updateOne: {
          filter: { examination, subject, student: rec.studentId },
          update: {
            $set: {
              internalMarks: numInternal,
              externalMarks: numExternal,
              totalMarks,
              grade,
              status
            }
          },
          upsert: true
        }
      });
    }

    const result = await Result.bulkWrite(operations);

    await recordAuditLog({
      req,
      action: 'MARKS_RECORDED',
      entityType: 'Result',
      entityId: String(subject),
      details: { examination, subject, count: records.length }
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Batch marks entry completed successfully',
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

module.exports = {
  getResults,
  recordResult,
  batchRecordResults
};
