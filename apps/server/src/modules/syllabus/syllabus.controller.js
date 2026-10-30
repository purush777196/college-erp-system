const mongoose = require('mongoose');
const SyllabusProgress = require('./syllabus.model');
const Faculty = require('../faculty/faculty.model');
const Subject = require('../subjects/subject.model');
const Timetable = require('../timetable/timetable.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');
const { recordAuditLog } = require('../../utils/auditLogger');

const SyllabusHistory = SyllabusProgress.SyllabusHistory;

/**
 * Resolve faculty document ID from authenticated user
 */
async function getFacultyDocId(user) {
  if (!user) return null;
  if (mongoose.connection.readyState === 1 && user.role === ROLES.FACULTY) {
    const profile = await Faculty.findOne({ user: user._id });
    if (profile) return profile._id;
  }
  return user._id;
}

/**
 * Verify subject access for the authenticated user
 */
async function verifySubjectAccess(user, subjectId) {
  const facId = await getFacultyDocId(user);
  const subject = await Subject.findById(subjectId).populate('department course').lean();
  if (!subject) {
    return { authorized: false, error: 'Subject not found', statusCode: HTTP_STATUS.NOT_FOUND };
  }

  // Super Admin and Principal have institutional access
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.PRINCIPAL) {
    return { authorized: true, facId, subject };
  }

  // HOD has department-level access
  if (user.role === ROLES.HOD) {
    const hodDept = user.department?._id || user.department;
    const subDept = subject.department?._id || subject.department;
    if (hodDept && subDept && String(hodDept) !== String(subDept)) {
      return { authorized: false, error: 'Access denied: Subject does not belong to your department', statusCode: HTTP_STATUS.FORBIDDEN };
    }
    return { authorized: true, facId, subject };
  }

  // Faculty must be assigned to the subject via Timetable or SyllabusProgress
  if (user.role === ROLES.FACULTY && facId) {
    const [hasTimetable, hasSyllabus] = await Promise.all([
      Timetable.exists({ faculty: facId, subject: subjectId }),
      SyllabusProgress.exists({ faculty: facId, subject: subjectId })
    ]);

    if (!hasTimetable && !hasSyllabus) {
      return { authorized: false, error: 'Access denied: You are not assigned to this subject syllabus', statusCode: HTTP_STATUS.FORBIDDEN };
    }
  }

  return { authorized: true, facId, subject };
}

/**
 * Generate default 5-unit curriculum structure
 */
function getDefaultUnitsForSubject(subject) {
  const subCode = subject?.code || 'CS';
  const subName = subject?.name || 'Curriculum Subject';
  return [
    {
      unitNumber: 1,
      title: `Unit I: Foundations & Principles of ${subName}`,
      description: 'Fundamental concepts, core terminology, theoretical basis and historical paradigms.',
      plannedHours: 10,
      status: 'not_started',
      displayOrder: 1,
      topics: [
        { title: 'Introduction & Core Terminology', estimatedHours: 2, status: 'not_started', displayOrder: 1 },
        { title: 'Theoretical Frameworks & Historical Evolution', estimatedHours: 3, status: 'not_started', displayOrder: 2 },
        { title: 'Mathematical Formulations & Model Assumptions', estimatedHours: 3, status: 'not_started', displayOrder: 3 },
        { title: 'Practical Constraints & Real-world Contexts', estimatedHours: 2, status: 'not_started', displayOrder: 4 }
      ]
    },
    {
      unitNumber: 2,
      title: `Unit II: Core Methodologies & Architectural Models`,
      description: 'System decomposition, structural models, modular designs and processing pipelines.',
      plannedHours: 12,
      status: 'not_started',
      displayOrder: 2,
      topics: [
        { title: 'Architectural Abstractions & Modular Hierarchy', estimatedHours: 3, status: 'not_started', displayOrder: 1 },
        { title: 'Data Flow Patterns & Interaction Protocols', estimatedHours: 3, status: 'not_started', displayOrder: 2 },
        { title: 'Component Interoperability & Interface Specifications', estimatedHours: 3, status: 'not_started', displayOrder: 3 },
        { title: 'State Transition Diagrams & Operational Analysis', estimatedHours: 3, status: 'not_started', displayOrder: 4 }
      ]
    },
    {
      unitNumber: 3,
      title: `Unit III: Analytical Algorithms & Implementation Frameworks`,
      description: 'Computational approaches, algorithmic complexity, implementation best practices.',
      plannedHours: 12,
      status: 'not_started',
      displayOrder: 3,
      topics: [
        { title: 'Algorithmic Formulations & Complexity Bounds', estimatedHours: 3, status: 'not_started', displayOrder: 1 },
        { title: 'Iterative & Recursive Computational Pipelines', estimatedHours: 3, status: 'not_started', displayOrder: 2 },
        { title: 'Optimization Techniques & Resource Utilization', estimatedHours: 3, status: 'not_started', displayOrder: 3 },
        { title: 'Simulation Studies & Empirical Profiling', estimatedHours: 3, status: 'not_started', displayOrder: 4 }
      ]
    },
    {
      unitNumber: 4,
      title: `Unit IV: Advanced Applications, Optimization & Case Studies`,
      description: 'Applied implementations, fault handling, industry scenarios and benchmark analysis.',
      plannedHours: 10,
      status: 'not_started',
      displayOrder: 4,
      topics: [
        { title: 'Real-world Case Studies & Industry Implementations', estimatedHours: 3, status: 'not_started', displayOrder: 1 },
        { title: 'Performance Profiling & Bottleneck Remediation', estimatedHours: 2, status: 'not_started', displayOrder: 2 },
        { title: 'Security Principles & Robust Exception Handling', estimatedHours: 3, status: 'not_started', displayOrder: 3 },
        { title: 'Scalability Strategies & Cloud Deployments', estimatedHours: 2, status: 'not_started', displayOrder: 4 }
      ]
    },
    {
      unitNumber: 5,
      title: `Unit V: Research Trends, Emerging Paradigms & Industry Standards`,
      description: 'Modern research breakthroughs, emerging tooling, sustainability and ethics.',
      plannedHours: 8,
      status: 'not_started',
      displayOrder: 5,
      topics: [
        { title: 'Emerging Paradigms & Contemporary Research', estimatedHours: 2, status: 'not_started', displayOrder: 1 },
        { title: 'Standards Compliance & Regulatory Frameworks', estimatedHours: 2, status: 'not_started', displayOrder: 2 },
        { title: 'Ethical Implications & Sustainable Engineering', estimatedHours: 2, status: 'not_started', displayOrder: 3 },
        { title: 'Future Research Vectors & Capstone Integration', estimatedHours: 2, status: 'not_started', displayOrder: 4 }
      ]
    }
  ];
}

/**
 * Calculate comprehensive syllabus stats, topics, hours and delay detection
 */
function calculateSyllabusMetrics(progressDoc) {
  const rawUnits = progressDoc?.units || [];
  const units = Array.isArray(rawUnits)
    ? rawUnits
    : (rawUnits && typeof rawUnits[Symbol.iterator] === 'function' ? Array.from(rawUnits) : Object.values(rawUnits).filter(v => v && typeof v === 'object' && v.unitNumber));
  const now = new Date();

  let totalTopics = 0;
  let completedTopics = 0;
  let inProgressTopics = 0;
  let notStartedTopics = 0;
  let totalEstimatedHours = 0;
  let completedEstimatedHours = 0;
  const delayedTopics = [];

  const unitSummaries = (Array.isArray(units) ? units : []).map((u) => {
    const rawTopics = u?.topics || [];
    const unitTopics = Array.isArray(rawTopics)
      ? rawTopics
      : (rawTopics && typeof rawTopics[Symbol.iterator] === 'function' ? Array.from(rawTopics) : Object.values(rawTopics).filter(v => v && typeof v === 'object' && v.title));
    const uTotalTopics = unitTopics.length;
    const uCompletedTopics = unitTopics.filter((t) => t.status === 'completed').length;
    const uInProgressTopics = unitTopics.filter((t) => t.status === 'in_progress').length;
    const uNotStartedTopics = uTotalTopics - uCompletedTopics - uInProgressTopics;

    let uTotalHours = 0;
    let uCompletedHours = 0;

    unitTopics.forEach((t) => {
      totalTopics++;
      const hrs = Number(t.estimatedHours) || 2;
      totalEstimatedHours += hrs;
      uTotalHours += hrs;

      if (t.status === 'completed') {
        completedTopics++;
        completedEstimatedHours += hrs;
        uCompletedHours += hrs;
      } else if (t.status === 'in_progress') {
        inProgressTopics++;
      } else {
        notStartedTopics++;
      }

      // Delayed check: plannedCompletionDate passed and topic not completed
      if (t.plannedCompletionDate && t.status !== 'completed') {
        const plannedDate = new Date(t.plannedCompletionDate);
        if (plannedDate < now) {
          const daysOverdue = Math.max(1, Math.floor((now.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24)));
          delayedTopics.push({
            topicId: t._id,
            topicTitle: t.title,
            unitId: u._id,
            unitNumber: u.unitNumber,
            unitTitle: u.title,
            plannedCompletionDate: t.plannedCompletionDate,
            daysOverdue,
            status: t.status,
            estimatedHours: hrs
          });
        }
      }
    });

    // If unit has no topics, use unit's plannedHours
    if (uTotalTopics === 0) {
      const uHours = Number(u.plannedHours) || 8;
      totalEstimatedHours += uHours;
      if (u.status === 'completed') {
        completedEstimatedHours += uHours;
      }
    }

    const uCompletionPercent = uTotalTopics > 0
      ? Math.round((uCompletedTopics / uTotalTopics) * 100)
      : (u.status === 'completed' ? 100 : (u.status === 'in_progress' ? 50 : 0));

    return {
      _id: u._id,
      unitNumber: u.unitNumber,
      title: u.title,
      description: u.description,
      status: u.status,
      plannedHours: u.plannedHours || uTotalHours || 8,
      plannedStartDate: u.plannedStartDate,
      targetCompletionDate: u.targetCompletionDate,
      totalTopics: uTotalTopics,
      completedTopics: uCompletedTopics,
      inProgressTopics: uInProgressTopics,
      completionPercentage: uCompletionPercent
    };
  });

  const completedUnits = units.filter((u) => u.status === 'completed').length;
  const inProgressUnits = units.filter((u) => u.status === 'in_progress').length;
  const notStartedUnits = units.length - completedUnits - inProgressUnits;

  // Completion percentage formula: (Completed Topics / Total Topics) * 100
  // Fallback to unit completion if no topics defined
  let completionPercentage = 0;
  if (totalTopics > 0) {
    completionPercentage = Math.round((completedTopics / totalTopics) * 100);
  } else if (units.length > 0) {
    completionPercentage = Math.round((completedUnits / units.length) * 100);
  }

  const remainingHours = Math.max(0, totalEstimatedHours - completedEstimatedHours);

  return {
    totalUnits: units.length,
    completedUnits,
    inProgressUnits,
    notStartedUnits,
    totalTopics,
    completedTopics,
    inProgressTopics,
    notStartedTopics,
    completionPercentage,
    totalEstimatedHours,
    completedEstimatedHours,
    remainingHours,
    delayedTopicsCount: delayedTopics.length,
    delayedTopics,
    unitSummaries
  };
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
      .populate('subject', 'name code credits semester department course')
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
          .populate('subject', 'name code credits semester department course')
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

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      message: 'Syllabus progress retrieved successfully',
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update unit status and progress (Legacy PATCH preserved)
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

    const oldStatus = unit.status;
    unit.status = status;
    if (completionRemarks) unit.completionRemarks = completionRemarks.trim();
    if (status === 'completed') {
      unit.completedAt = new Date();
    } else {
      unit.completedAt = null;
    }

    await progress.save();

    // Log progress history
    if (SyllabusHistory && mongoose.connection.readyState === 1) {
      await SyllabusHistory.create({
        syllabus: progress._id,
        subject: progress.subject,
        faculty: progress.faculty,
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        unitTitle: unit.title,
        previousStatus: oldStatus,
        newStatus: status,
        updatedBy: req.user._id,
        notes: completionRemarks || `Unit ${unit.unitNumber} marked as ${status}`
      }).catch((e) => console.warn('Failed to record syllabus history:', e.message));
    }

    await recordAuditLog({
      req,
      action: 'SYLLABUS_PROGRESS_UPDATED',
      entityType: 'SyllabusProgress',
      entityId: String(progress._id),
      details: { subjectId, unitNumber, status }
    });

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      message: `Unit ${unitNumber} updated to ${status}`,
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
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
      .populate('subject', 'name code credits semester department course')
      .lean();

    const data = records.map((rec) => {
      const summary = calculateSyllabusMetrics(rec);
      return {
        ...rec,
        summary
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

/**
 * Create a new Unit in the syllabus
 * POST /api/v1/syllabus/subject/:subjectId/units
 */
async function createUnit(req, res, next) {
  try {
    const { subjectId } = req.params;
    const { title, description = '', plannedHours = 8, plannedStartDate, targetCompletionDate } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Unit title is required.',
        code: 'VALIDATION_ERROR'
      });
    }

    const facId = await getFacultyDocId(req.user);
    let progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });

    if (!progress && mongoose.connection.readyState === 1) {
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        return sendError(res, {
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Subject not found.',
          code: 'NOT_FOUND'
        });
      }
      progress = await SyllabusProgress.create({
        subject: subject._id,
        faculty: facId,
        units: []
      });
    }

    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus progress record not found.',
        code: 'NOT_FOUND'
      });
    }

    const nextUnitNum = progress.units.length > 0
      ? Math.max(...progress.units.map((u) => u.unitNumber || 0)) + 1
      : 1;

    const newUnit = {
      unitNumber: nextUnitNum,
      title: title.trim(),
      description: description.trim(),
      plannedHours: Number(plannedHours) || 8,
      plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
      displayOrder: nextUnitNum,
      status: 'not_started',
      topics: []
    };

    progress.units.push(newUnit);
    await progress.save();

    await recordAuditLog({
      req,
      action: 'SYLLABUS_UNIT_CREATED',
      entityType: 'SyllabusProgress',
      entityId: String(progress._id),
      details: { subjectId, unitNumber: nextUnitNum, title: newUnit.title }
    });

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: `Unit ${nextUnitNum} created successfully`,
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Edit an existing Unit
 * PUT /api/v1/syllabus/subject/:subjectId/units/:unitId
 */
async function updateUnit(req, res, next) {
  try {
    const { subjectId, unitId } = req.params;
    const { title, description, plannedHours, plannedStartDate, targetCompletionDate, status, completionRemarks } = req.body;
    const facId = await getFacultyDocId(req.user);

    const progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });
    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus progress record not found.',
        code: 'NOT_FOUND'
      });
    }

    const unit = progress.units.id(unitId) || progress.units.find((u) => String(u._id) === String(unitId));
    if (!unit) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Unit not found.',
        code: 'NOT_FOUND'
      });
    }

    if (title !== undefined && title.trim()) unit.title = title.trim();
    if (description !== undefined) unit.description = description.trim();
    if (plannedHours !== undefined) unit.plannedHours = Number(plannedHours) || unit.plannedHours;
    if (plannedStartDate !== undefined) unit.plannedStartDate = plannedStartDate ? new Date(plannedStartDate) : null;
    if (targetCompletionDate !== undefined) unit.targetCompletionDate = targetCompletionDate ? new Date(targetCompletionDate) : null;
    if (completionRemarks !== undefined) unit.completionRemarks = completionRemarks.trim();

    if (status) {
      const validStatuses = ['not_started', 'in_progress', 'completed'];
      if (!validStatuses.includes(status)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid unit status',
          code: 'INVALID_STATUS'
        });
      }
      const prevStatus = unit.status;
      unit.status = status;
      unit.completedAt = status === 'completed' ? new Date() : null;

      if (SyllabusHistory && mongoose.connection.readyState === 1 && prevStatus !== status) {
        await SyllabusHistory.create({
          syllabus: progress._id,
          subject: progress.subject,
          faculty: progress.faculty,
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          unitTitle: unit.title,
          previousStatus: prevStatus,
          newStatus: status,
          updatedBy: req.user._id,
          notes: completionRemarks || `Unit status updated to ${status}`
        }).catch((e) => console.warn('Failed to record syllabus history:', e.message));
      }
    }

    await progress.save();

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      message: `Unit updated successfully`,
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a Unit safely
 * DELETE /api/v1/syllabus/subject/:subjectId/units/:unitId
 */
async function deleteUnit(req, res, next) {
  try {
    const { subjectId, unitId } = req.params;
    const facId = await getFacultyDocId(req.user);

    const progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });
    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus record not found',
        code: 'NOT_FOUND'
      });
    }

    const unitIndex = progress.units.findIndex((u) => String(u._id) === String(unitId));
    if (unitIndex === -1) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Unit not found',
        code: 'NOT_FOUND'
      });
    }

    const removedUnit = progress.units[unitIndex];
    progress.units.splice(unitIndex, 1);
    await progress.save();

    await recordAuditLog({
      req,
      action: 'SYLLABUS_UNIT_DELETED',
      entityType: 'SyllabusProgress',
      entityId: String(progress._id),
      details: { subjectId, unitNumber: removedUnit.unitNumber, title: removedUnit.title }
    });

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      message: `Unit ${removedUnit.unitNumber} deleted successfully`,
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a Topic inside a Unit
 * POST /api/v1/syllabus/subject/:subjectId/units/:unitId/topics
 */
async function createTopic(req, res, next) {
  try {
    const { subjectId, unitId } = req.params;
    const { title, description = '', estimatedHours = 2, plannedCompletionDate, teachingNotes = '' } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Topic title is required.',
        code: 'VALIDATION_ERROR'
      });
    }

    const facId = await getFacultyDocId(req.user);
    const progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });
    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus record not found.',
        code: 'NOT_FOUND'
      });
    }

    const unit = progress.units.id(unitId) || progress.units.find((u) => String(u._id) === String(unitId));
    if (!unit) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Unit not found.',
        code: 'NOT_FOUND'
      });
    }

    if (!unit.topics) unit.topics = [];
    const nextOrder = unit.topics.length + 1;

    const newTopic = {
      title: title.trim(),
      description: description.trim(),
      estimatedHours: Number(estimatedHours) || 2,
      plannedCompletionDate: plannedCompletionDate ? new Date(plannedCompletionDate) : null,
      actualCompletionDate: null,
      teachingNotes: teachingNotes.trim(),
      status: 'not_started',
      displayOrder: nextOrder
    };

    unit.topics.push(newTopic);
    await progress.save();

    // Log progress history
    if (SyllabusHistory && mongoose.connection.readyState === 1) {
      const added = unit.topics[unit.topics.length - 1];
      await SyllabusHistory.create({
        syllabus: progress._id,
        subject: progress.subject,
        faculty: progress.faculty,
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        unitTitle: unit.title,
        topicId: added._id,
        topicTitle: added.title,
        previousStatus: 'created',
        newStatus: 'not_started',
        updatedBy: req.user._id,
        notes: `Topic "${added.title}" added to Unit ${unit.unitNumber}`
      }).catch((e) => console.warn('Failed to record syllabus history:', e.message));
    }

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Topic created successfully',
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing Topic (including progress status and teaching notes)
 * PUT /api/v1/syllabus/subject/:subjectId/units/:unitId/topics/:topicId
 */
async function updateTopic(req, res, next) {
  try {
    const { subjectId, unitId, topicId } = req.params;
    const { title, description, estimatedHours, plannedCompletionDate, status, teachingNotes } = req.body;
    const facId = await getFacultyDocId(req.user);

    const progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });
    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus record not found.',
        code: 'NOT_FOUND'
      });
    }

    const unit = progress.units.id(unitId) || progress.units.find((u) => String(u._id) === String(unitId));
    if (!unit) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Unit not found.',
        code: 'NOT_FOUND'
      });
    }

    const topic = unit.topics.id(topicId) || unit.topics.find((t) => String(t._id) === String(topicId));
    if (!topic) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Topic not found.',
        code: 'NOT_FOUND'
      });
    }

    const prevStatus = topic.status;

    if (title !== undefined && title.trim()) topic.title = title.trim();
    if (description !== undefined) topic.description = description.trim();
    if (estimatedHours !== undefined) topic.estimatedHours = Number(estimatedHours) || topic.estimatedHours;
    if (plannedCompletionDate !== undefined) topic.plannedCompletionDate = plannedCompletionDate ? new Date(plannedCompletionDate) : null;
    if (teachingNotes !== undefined) topic.teachingNotes = teachingNotes.trim();

    if (status) {
      const validStatuses = ['not_started', 'in_progress', 'completed'];
      if (!validStatuses.includes(status)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid topic status. Must be not_started, in_progress, or completed.',
          code: 'INVALID_STATUS'
        });
      }
      topic.status = status;
      if (status === 'completed') {
        topic.actualCompletionDate = new Date();
      } else {
        topic.actualCompletionDate = null;
      }
    }

    // Auto-harmonize parent unit status based on topics
    const totalUnitTopics = unit.topics.length;
    const completedUnitTopics = unit.topics.filter((t) => t.status === 'completed').length;
    const inProgressUnitTopics = unit.topics.filter((t) => t.status === 'in_progress').length;

    if (totalUnitTopics > 0) {
      if (completedUnitTopics === totalUnitTopics) {
        unit.status = 'completed';
        unit.completedAt = new Date();
      } else if (completedUnitTopics > 0 || inProgressUnitTopics > 0) {
        unit.status = 'in_progress';
        unit.completedAt = null;
      } else {
        unit.status = 'not_started';
        unit.completedAt = null;
      }
    }

    await progress.save();

    // Log progress history if status or teachingNotes changed
    if (SyllabusHistory && mongoose.connection.readyState === 1 && (prevStatus !== topic.status || teachingNotes)) {
      await SyllabusHistory.create({
        syllabus: progress._id,
        subject: progress.subject,
        faculty: progress.faculty,
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        unitTitle: unit.title,
        topicId: topic._id,
        topicTitle: topic.title,
        previousStatus: prevStatus,
        newStatus: topic.status,
        updatedBy: req.user._id,
        notes: teachingNotes || `Topic status changed from ${prevStatus} to ${topic.status}`
      }).catch((e) => console.warn('Failed to record syllabus history:', e.message));
    }

    await recordAuditLog({
      req,
      action: 'SYLLABUS_TOPIC_UPDATED',
      entityType: 'SyllabusProgress',
      entityId: String(progress._id),
      details: { subjectId, unitId, topicId, status: topic.status }
    });

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      message: `Topic updated to ${topic.status}`,
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a Topic from a Unit
 * DELETE /api/v1/syllabus/subject/:subjectId/units/:unitId/topics/:topicId
 */
async function deleteTopic(req, res, next) {
  try {
    const { subjectId, unitId, topicId } = req.params;
    const facId = await getFacultyDocId(req.user);

    const progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });
    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus record not found.',
        code: 'NOT_FOUND'
      });
    }

    const unit = progress.units.id(unitId) || progress.units.find((u) => String(u._id) === String(unitId));
    if (!unit) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Unit not found.',
        code: 'NOT_FOUND'
      });
    }

    const topicIndex = unit.topics.findIndex((t) => String(t._id) === String(topicId));
    if (topicIndex === -1) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Topic not found.',
        code: 'NOT_FOUND'
      });
    }

    const removedTopic = unit.topics[topicIndex];
    unit.topics.splice(topicIndex, 1);
    await progress.save();

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      message: `Topic "${removedTopic.title}" deleted successfully`,
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get comprehensive Syllabus Progress Analytics & Delayed Topics
 * GET /api/v1/syllabus/subject/:subjectId/progress
 */
async function getSyllabusProgressAnalytics(req, res, next) {
  try {
    const { subjectId } = req.params;
    const facId = await getFacultyDocId(req.user);

    const progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId })
      .populate('subject', 'name code credits semester department course')
      .populate('faculty', 'employeeId designation');

    if (!progress) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Syllabus progress record not found',
        code: 'NOT_FOUND'
      });
    }

    const summary = calculateSyllabusMetrics(progress);

    // Fetch timetable sessions for schedule context
    const timetableSlots = await Timetable.find({ subject: subjectId, faculty: facId })
      .sort({ dayOfWeek: 1, periodNumber: 1 })
      .lean();

    const weeklySessionsCount = timetableSlots.length;
    const weeklyPlannedHours = weeklySessionsCount * 1; // Approx 1 hr per period

    return sendSuccess(res, {
      message: 'Syllabus progress analytics retrieved',
      data: {
        summary,
        scheduleContext: {
          weeklySessionsCount,
          weeklyPlannedHours,
          slots: timetableSlots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            periodNumber: s.periodNumber,
            startTime: s.startTime,
            endTime: s.endTime,
            roomNumber: s.roomNumber,
            section: s.section
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get History of Syllabus Progress Updates
 * GET /api/v1/syllabus/subject/:subjectId/history
 */
async function getSyllabusHistory(req, res, next) {
  try {
    const { subjectId } = req.params;
    const facId = await getFacultyDocId(req.user);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const query = { subject: subjectId, faculty: facId };

    const [total, history] = await Promise.all([
      SyllabusHistory.countDocuments(query),
      SyllabusHistory.find(query)
        .populate('updatedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    return sendSuccess(res, {
      message: 'Syllabus update history retrieved',
      data: history,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Initialize default curriculum syllabus for a subject
 * POST /api/v1/syllabus/subject/:subjectId/initialize
 */
async function initializeSubjectSyllabus(req, res, next) {
  try {
    const { subjectId } = req.params;
    const facId = await getFacultyDocId(req.user);

    let progress = await SyllabusProgress.findOne({ subject: subjectId, faculty: facId });
    if (progress && progress.units && progress.units.length > 0) {
      return sendError(res, {
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Syllabus already initialized for this subject',
        code: 'ALREADY_EXISTS'
      });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Subject not found',
        code: 'NOT_FOUND'
      });
    }

    if (!progress) {
      progress = await SyllabusProgress.create({
        subject: subject._id,
        faculty: facId,
        units: getDefaultUnitsForSubject(subject)
      });
    } else {
      progress.units = getDefaultUnitsForSubject(subject);
      await progress.save();
    }

    const summary = calculateSyllabusMetrics(progress);

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Standard syllabus template initialized successfully',
      data: {
        ...(progress.toObject ? progress.toObject() : progress),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSubjectSyllabus,
  updateUnitProgress,
  listFacultySyllabusProgress,
  createUnit,
  updateUnit,
  deleteUnit,
  createTopic,
  updateTopic,
  deleteTopic,
  getSyllabusProgressAnalytics,
  getSyllabusHistory,
  initializeSubjectSyllabus
};
