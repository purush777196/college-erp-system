const { Assignment, Submission } = require('./assignment.model');
const Faculty = require('../faculty/faculty.model');
const Subject = require('../subjects/subject.model');
const Student = require('../students/student.model');
const mongoose = require('mongoose');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');

async function getFacultyDocId(user) {
  if (!user) return null;
  if (mongoose.connection.readyState === 1 && user.role === ROLES.FACULTY) {
    const profile = await Faculty.findOne({ user: user._id });
    if (profile) return profile._id;
  }
  return user._id;
}

/**
 * List assignments for authenticated faculty
 * GET /api/v1/assignments
 */
async function listAssignments(req, res, next) {
  try {
    const query = {};

    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      query.faculty = facId;
    }

    if (req.query.subject) query.subject = req.query.subject;
    if (req.query.semester) query.semester = Number(req.query.semester);
    if (req.query.status) query.status = req.query.status;

    const assignments = await Assignment.find(query)
      .populate('subject', 'name code credits semester')
      .populate('department', 'name code')
      .populate({
        path: 'faculty',
        select: 'employeeId designation',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ createdAt: -1 })
      .lean();

    // Compute dynamic submission stats & status for each assignment
    const now = new Date();
    const enriched = await Promise.all(
      assignments.map(async (assign) => {
        let currentStatus = assign.status;
        if (currentStatus === 'published' && now > new Date(assign.dueDate)) {
          currentStatus = 'deadline_passed';
        }

        let submissionCount = 0;
        let evaluatedCount = 0;
        if (mongoose.connection.readyState === 1) {
          submissionCount = await Submission.countDocuments({ assignment: assign._id });
          evaluatedCount = await Submission.countDocuments({ assignment: assign._id, status: 'evaluated' });
        }

        return {
          ...assign,
          status: currentStatus,
          submissionCount,
          evaluatedCount,
          pendingEvaluationCount: Math.max(0, submissionCount - evaluatedCount)
        };
      })
    );

    return sendSuccess(res, {
      message: 'Faculty assignments retrieved successfully',
      data: enriched,
      meta: { count: enriched.length }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single assignment by ID
 * GET /api/v1/assignments/:id
 */
async function getAssignmentById(req, res, next) {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('subject', 'name code credits semester department')
      .populate('department', 'name code')
      .populate({
        path: 'faculty',
        select: 'employeeId designation',
        populate: { path: 'user', select: 'name email' }
      });

    if (!assignment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Assignment not found',
        code: 'NOT_FOUND'
      });
    }

    // Role ownership check for faculty
    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      if (String(assignment.faculty?._id || assignment.faculty) !== String(facId)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Access denied: You are not authorized to view this assignment',
          code: 'FORBIDDEN'
        });
      }
    }

    return sendSuccess(res, {
      message: 'Assignment retrieved successfully',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create new assignment
 * POST /api/v1/assignments
 */
async function createAssignment(req, res, next) {
  try {
    const {
      title,
      description = '',
      subject,
      semester,
      section = 'A',
      maxMarks = 20,
      status = 'draft',
      dueDate,
      instructions = '',
      attachments = []
    } = req.body;

    const facId = await getFacultyDocId(req.user);
    if (!facId) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Faculty profile could not be identified',
        code: 'FACULTY_NOT_FOUND'
      });
    }

    // Fetch subject to resolve department & course if available
    let deptId = null;
    let courseId = null;
    if (mongoose.connection.readyState === 1 && subject) {
      const subDoc = await Subject.findById(subject);
      if (subDoc) {
        deptId = subDoc.department;
        courseId = subDoc.course;
      }
    }

    const publishDate = status === 'published' ? new Date() : null;

    const assignment = await Assignment.create({
      title: title.trim(),
      description: description.trim(),
      subject,
      faculty: facId,
      department: deptId,
      course: courseId,
      semester: Number(semester),
      section,
      maxMarks: Number(maxMarks),
      status,
      publishDate,
      dueDate: new Date(dueDate),
      instructions: instructions.trim(),
      attachments
    });

    await recordAuditLog({
      req,
      action: 'ASSIGNMENT_CREATED',
      entityType: 'Assignment',
      entityId: String(assignment._id),
      details: { title, subject, semester, maxMarks, status }
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Assignment created successfully',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing assignment
 * PUT /api/v1/assignments/:id
 */
async function updateAssignment(req, res, next) {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Assignment not found',
        code: 'NOT_FOUND'
      });
    }

    // Faculty ownership verification
    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      if (String(assignment.faculty) !== String(facId)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'You are not authorized to update this assignment',
          code: 'FORBIDDEN'
        });
      }
    }

    const {
      title,
      description,
      subject,
      semester,
      section,
      maxMarks,
      status,
      dueDate,
      instructions,
      attachments
    } = req.body;

    if (title !== undefined) assignment.title = title.trim();
    if (description !== undefined) assignment.description = description.trim();
    if (subject !== undefined) assignment.subject = subject;
    if (semester !== undefined) assignment.semester = Number(semester);
    if (section !== undefined) assignment.section = section;
    if (maxMarks !== undefined) assignment.maxMarks = Number(maxMarks);
    if (instructions !== undefined) assignment.instructions = instructions.trim();
    if (dueDate !== undefined) assignment.dueDate = new Date(dueDate);
    if (attachments !== undefined) assignment.attachments = attachments;

    if (status !== undefined) {
      if (status === 'published' && assignment.status !== 'published') {
        assignment.publishDate = new Date();
      }
      assignment.status = status;
    }

    await assignment.save();

    await recordAuditLog({
      req,
      action: 'ASSIGNMENT_UPDATED',
      entityType: 'Assignment',
      entityId: String(assignment._id),
      details: { title: assignment.title, status: assignment.status }
    });

    return sendSuccess(res, {
      message: 'Assignment updated successfully',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an assignment
 * DELETE /api/v1/assignments/:id
 */
async function deleteAssignment(req, res, next) {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Assignment not found',
        code: 'NOT_FOUND'
      });
    }

    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      if (String(assignment.faculty) !== String(facId)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'You are not authorized to delete this assignment',
          code: 'FORBIDDEN'
        });
      }
    }

    await Assignment.findByIdAndDelete(req.params.id);
    await Submission.deleteMany({ assignment: req.params.id });

    await recordAuditLog({
      req,
      action: 'ASSIGNMENT_DELETED',
      entityType: 'Assignment',
      entityId: String(req.params.id),
      details: { title: assignment.title }
    });

    return sendSuccess(res, {
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Publish an assignment (draft -> published)
 * PATCH /api/v1/assignments/:id/publish
 */
async function publishAssignment(req, res, next) {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Assignment not found',
        code: 'NOT_FOUND'
      });
    }

    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      if (String(assignment.faculty) !== String(facId)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'You are not authorized to publish this assignment',
          code: 'FORBIDDEN'
        });
      }
    }

    assignment.status = 'published';
    assignment.publishDate = new Date();
    await assignment.save();

    await recordAuditLog({
      req,
      action: 'ASSIGNMENT_PUBLISHED',
      entityType: 'Assignment',
      entityId: String(assignment._id),
      details: { title: assignment.title }
    });

    return sendSuccess(res, {
      message: 'Assignment published successfully',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all submissions for an assignment with full enrolled roster tracking
 * GET /api/v1/assignments/:id/submissions
 */
async function listAssignmentSubmissions(req, res, next) {
  try {
    const assignment = await Assignment.findById(req.params.id).populate('subject');
    if (!assignment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Assignment not found',
        code: 'NOT_FOUND'
      });
    }

    if (req.user.role === ROLES.FACULTY) {
      const facId = await getFacultyDocId(req.user);
      if (String(assignment.faculty) !== String(facId)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'You are not authorized to view submissions for this assignment',
          code: 'FORBIDDEN'
        });
      }
    }

    // Get submissions for this assignment
    const submissions = await Submission.find({ assignment: assignment._id })
      .populate({
        path: 'student',
        select: 'rollNumber enrollmentNumber batchYear currentSemester',
        populate: { path: 'user', select: 'name email' }
      })
      .sort({ submittedAt: -1 })
      .lean();

    // Query enrolled students for this subject & semester
    let enrolledStudents = [];
    if (mongoose.connection.readyState === 1) {
      const query = { currentSemester: assignment.semester };
      if (assignment.department) query.department = assignment.department;
      enrolledStudents = await Student.find(query)
        .populate('user', 'name email')
        .sort({ rollNumber: 1 })
        .lean();
    }

    // Map roster items
    const submissionMap = new Map();
    submissions.forEach((sub) => {
      const stId = String(sub.student?._id || sub.student);
      submissionMap.set(stId, sub);
    });

    const roster = enrolledStudents.map((st) => {
      const stId = String(st._id);
      const sub = submissionMap.get(stId);
      if (sub) {
        return {
          studentId: st._id,
          rollNumber: st.rollNumber,
          name: st.user?.name || 'Student',
          email: st.user?.email || '',
          submissionId: sub._id,
          submittedAt: sub.submittedAt,
          content: sub.content,
          attachments: sub.attachments || [],
          status: sub.status,
          marksObtained: sub.marksObtained,
          feedback: sub.feedback,
          evaluatedAt: sub.evaluatedAt
        };
      }
      return {
        studentId: st._id,
        rollNumber: st.rollNumber,
        name: st.user?.name || 'Student',
        email: st.user?.email || '',
        submissionId: null,
        submittedAt: null,
        content: '',
        attachments: [],
        status: 'pending',
        marksObtained: null,
        feedback: '',
        evaluatedAt: null
      };
    });

    return sendSuccess(res, {
      message: 'Assignment submissions retrieved successfully',
      data: {
        assignment: {
          _id: assignment._id,
          title: assignment.title,
          maxMarks: assignment.maxMarks,
          dueDate: assignment.dueDate,
          status: assignment.status
        },
        submissions,
        roster,
        summary: {
          enrolledCount: roster.length,
          submittedCount: submissions.length,
          evaluatedCount: submissions.filter((s) => s.status === 'evaluated').length,
          pendingSubmissionCount: Math.max(0, roster.length - submissions.length)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Evaluate a student's submission
 * POST /api/v1/assignments/:id/submissions/:submissionId/evaluate
 */
async function evaluateSubmission(req, res, next) {
  try {
    const { marksObtained, feedback = '' } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Assignment not found',
        code: 'NOT_FOUND'
      });
    }

    const facId = await getFacultyDocId(req.user);
    if (req.user.role === ROLES.FACULTY && String(assignment.faculty) !== String(facId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'You are not authorized to grade this assignment',
        code: 'FORBIDDEN'
      });
    }

    const numMarks = Number(marksObtained);
    if (isNaN(numMarks) || numMarks < 0 || numMarks > assignment.maxMarks) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: `Marks obtained must be between 0 and maximum marks (${assignment.maxMarks})`,
        code: 'INVALID_MARKS'
      });
    }

    let submission = await Submission.findById(req.params.submissionId);
    if (!submission) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Submission not found',
        code: 'NOT_FOUND'
      });
    }

    submission.marksObtained = numMarks;
    submission.feedback = feedback.trim();
    submission.status = 'evaluated';
    submission.evaluatedAt = new Date();
    submission.evaluatedBy = facId;
    await submission.save();

    await recordAuditLog({
      req,
      action: 'SUBMISSION_EVALUATED',
      entityType: 'Submission',
      entityId: String(submission._id),
      details: {
        assignmentId: assignment._id,
        studentId: submission.student,
        marksObtained: numMarks,
        maxMarks: assignment.maxMarks
      }
    });

    return sendSuccess(res, {
      message: 'Submission evaluated successfully',
      data: submission
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record a submission (student or faculty entry)
 * POST /api/v1/assignments/:id/submit
 */
async function recordSubmission(req, res, next) {
  try {
    const { studentId, content = '', attachments = [] } = req.body;
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Assignment not found',
        code: 'NOT_FOUND'
      });
    }

    let studentRef = studentId;
    if (req.user.role === ROLES.STUDENT) {
      const studentProfile = await Student.findOne({ user: req.user._id });
      if (!studentProfile) {
        return sendError(res, {
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Student profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
      }
      studentRef = studentProfile._id;
    }

    if (!studentRef) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Student reference is required',
        code: 'MISSING_STUDENT'
      });
    }

    const isLate = new Date() > new Date(assignment.dueDate);
    const submission = await Submission.findOneAndUpdate(
      { assignment: assignment._id, student: studentRef },
      {
        content,
        attachments,
        submittedAt: new Date(),
        status: isLate ? 'late' : 'submitted'
      },
      { upsert: true, new: true, runValidators: true }
    );

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Assignment submitted successfully',
      data: submission
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  publishAssignment,
  listAssignmentSubmissions,
  evaluateSubmission,
  recordSubmission
};
