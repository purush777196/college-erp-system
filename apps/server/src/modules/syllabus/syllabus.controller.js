const SyllabusProgress = require('./syllabus.model');
const Faculty = require('../faculty/faculty.model');
const Subject = require('../subjects/subject.model');
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

function getDefaultUnitsForSubject(subject) {
  const subCode = subject?.code || 'CS';
  const subName = subject?.name || 'Curriculum Subject';
  return [
    { unitNumber: 1, title: `Unit I: Foundations & Principles of ${subName}`, plannedHours: 10, status: 'not_started' },
    { unitNumber: 2, title: `Unit II: Core Methodologies & Architectural Models`, plannedHours: 12, status: 'not_started' },
    { unitNumber: 3, title: `Unit III: Analytical Algorithms & Implementation Frameworks`, plannedHours: 12, status: 'not_started' },
    { unitNumber: 4, title: `Unit IV: Advanced Applications, Optimization & Case Studies`, plannedHours: 10, status: 'not_started' },
    { unitNumber: 5, title: `Unit V: Research Trends, Emerging Paradigms & Industry Standards`, plannedHours: 8, status: 'not_started' }
  ];
}

/**
 * Get or initialize syllabus progress for a subject
 * GET /api/v1/syllabus/subject/:subjectId
 */
async function getSubjectSyllabus(req, res, next) {
  try {
    const { subjectId } = req.params;
    const facId = await getFacultyDocId(req.user);

    let progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId })
      .populate('subject', 'name code credits semester department')
      .populate('faculty', 'employeeId designation');

    if (!progress && mongoose.connection.readyState === 1) {
      const subject = await Subject.findById(subjectId);
      if (subject) {
        progress = await SyllabusProgress.create({
          subject: subject._id,
          faculty: facId,
          units: getDefaultUnitsForSubject(subject)
        });
        progress = await SyllabusProgress.findById(progress._id)
          .populate('subject', 'name code credits semester department')
          .populate('faculty', 'employeeId designation');
      }
    }

    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Subject not found or syllabus not initialized',
        code: 'NOT_FOUND'
      });
    }

    const units = progress.units || [];
    const completedUnits = units.filter((u) => u.status === 'completed').length;
    const inProgressUnits = units.filter((u) => u.status === 'in_progress').length;
    const completionPercentage = units.length > 0 ? Math.round((completedUnits / units.length) * 100) : 0;

    return sendSuccess(res, {
      message: 'Syllabus progress retrieved successfully',
      data: {
        ...progress.toObject ? progress.toObject() : progress,
        summary: {
          totalUnits: units.length,
          completedUnits,
          inProgressUnits,
          notStartedUnits: units.length - completedUnits - inProgressUnits,
          completionPercentage
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update unit status and progress
 * PATCH /api/v1/syllabus/subject/:subjectId/unit/:unitNumber
 */
async function updateUnitProgress(req, res, next) {
  try {
    const { subjectId, unitNumber } = req.params;
    const { status, completionRemarks = '' } = req.body;
    const facId = await getFacultyDocId(req.user);

    const validStatuses = ['not_started', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid unit status. Must be not_started, in_progress, or completed.',
        code: 'INVALID_STATUS'
      });
    }

    let progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });
    if (!progress && mongoose.connection.readyState === 1) {
      const subject = await Subject.findById(subjectId);
      if (subject) {
        progress = await SyllabusProgress.create({
          subject: subject._id,
          faculty: facId,
          units: getDefaultUnitsForSubject(subject)
        });
      }
    }

    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus progress record not found',
        code: 'NOT_FOUND'
      });
    }

    const unit = progress.units.find((u) => Number(u.unitNumber) === Number(unitNumber));
    if (!unit) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: `Unit ${unitNumber} not found in curriculum syllabus`,
        code: 'UNIT_NOT_FOUND'
      });
    }

    unit.status = status;
    if (completionRemarks) unit.completionRemarks = completionRemarks.trim();
    if (status === 'completed') {
      unit.completedAt = new Date();
    } else {
      unit.completedAt = null;
    }

    await progress.save();

    await recordAuditLog({
      req,
      action: 'SYLLABUS_PROGRESS_UPDATED',
      entityType: 'SyllabusProgress',
      entityId: String(progress._id),
      details: { subjectId, unitNumber, status }
    });

    const units = progress.units || [];
    const completedUnits = units.filter((u) => u.status === 'completed').length;
    const inProgressUnits = units.filter((u) => u.status === 'in_progress').length;
    const completionPercentage = units.length > 0 ? Math.round((completedUnits / units.length) * 100) : 0;

    return sendSuccess(res, {
      message: `Unit ${unitNumber} updated to ${status}`,
      data: {
        ...progress.toObject ? progress.toObject() : progress,
        summary: {
          totalUnits: units.length,
          completedUnits,
          inProgressUnits,
          completionPercentage
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all syllabus progress summaries for faculty
 * GET /api/v1/syllabus/faculty/summary
 */
async function listFacultySyllabusProgress(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const records = await SyllabusProgress.find({ faculty: facId })
      .populate('subject', 'name code credits semester department')
      .lean();

    const data = records.map((rec) => {
      const units = rec.units || [];
      const completedUnits = units.filter((u) => u.status === 'completed').length;
      const inProgressUnits = units.filter((u) => u.status === 'in_progress').length;
      const completionPercentage = units.length > 0 ? Math.round((completedUnits / units.length) * 100) : 0;
      return {
        ...rec,
        summary: {
          totalUnits: units.length,
          completedUnits,
          inProgressUnits,
          completionPercentage
        }
      };
    });

    return sendSuccess(res, {
      message: 'Faculty syllabus progress overview retrieved',
      data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSubjectSyllabus,
  updateUnitProgress,
  listFacultySyllabusProgress
};
