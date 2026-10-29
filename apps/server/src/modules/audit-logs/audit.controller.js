const AuditLog = require('./audit.model');
const Department = require('../departments/department.model');
const User = require('../auth/auth.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');

/**
 * GET /api/v1/audit-logs
 * List, filter, and search persisted security audit events
 */
async function listAuditLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) {
        query.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (req.query.action) query.action = req.query.action;
    if (req.query.entityType) query.entityType = req.query.entityType;
    if (req.query.outcome) query.outcome = req.query.outcome;
    if (req.query.actor) query.user = req.query.actor;

    // Free text search in action or entityType
    if (req.query.q && typeof req.query.q === 'string' && req.query.q.trim()) {
      const regex = new RegExp(req.query.q.trim(), 'i');
      query.$or = [{ action: regex }, { entityType: regex }, { ipAddress: regex }];
    }

    // Role-based department scoping for HOD: strictly isolate to department scope
    if (req.user && req.user.role === ROLES.HOD) {
      let hodDept = null;
      if (req.user.department) {
        hodDept = await Department.findOne({
          $or: [{ name: req.user.department }, { hod: req.user._id }]
        });
      } else {
        hodDept = await Department.findOne({ hod: req.user._id });
      }

      if (hodDept) {
        const deptUsers = await User.find({
          $or: [{ department: hodDept.name }, { _id: req.user._id }]
        }).select('_id');
        const deptUserIds = deptUsers.map((u) => u._id);

        const deptConditions = [
          { user: { $in: deptUserIds } },
          { 'details.department': hodDept.name },
          { 'details.departmentId': hodDept._id.toString() },
          { 'details.departmentCode': hodDept.code },
          { entityType: { $in: ['Subject', 'Timetable', 'Attendance', 'Examination', 'Result', 'Notice'] } }
        ];

        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: deptConditions }];
          delete query.$or;
        } else {
          query.$or = deptConditions;
        }
      } else {
        query.user = req.user._id;
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'name email role department')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      AuditLog.countDocuments(query)
    ]);

    return sendSuccess(res, {
      message: 'System audit logs retrieved successfully',
      data: logs,
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

/**
 * GET /api/v1/audit-logs/:id
 * Retrieve details of a specific audit log entry
 */
async function getAuditLogById(req, res, next) {
  try {
    const log = await AuditLog.findById(req.params.id).populate('user', 'name email role department');
    if (!log) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Audit log record not found',
        code: 'NOT_FOUND'
      });
    }

    return sendSuccess(res, {
      message: 'Audit log record retrieved',
      data: log
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/audit-logs/export
 * Export audit events to CSV with sensitive fields strictly masked
 */
async function exportAuditLogsCsv(req, res, next) {
  try {
    const query = {};
    if (req.query.action) query.action = req.query.action;
    if (req.query.entityType) query.entityType = req.query.entityType;
    if (req.query.outcome) query.outcome = req.query.outcome;

    const logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(500);

    const headers = [
      'Timestamp (UTC)',
      'Actor Name',
      'Actor Email',
      'Role',
      'Action Type',
      'Affected Module',
      'Entity ID',
      'Outcome',
      'IP Address',
      'User Agent',
      'Request ID'
    ];

    const rows = logs.map((l) => [
      l.createdAt ? new Date(l.createdAt).toISOString() : '',
      `"${(l.user?.name || 'System / Unauthenticated').replace(/"/g, '""')}"`,
      l.user?.email || 'N/A',
      l.user?.role || 'N/A',
      l.action,
      l.entityType,
      l.entityId || '',
      l.outcome || 'success',
      l.ipAddress || '',
      `"${(l.userAgent || '').replace(/"/g, '""')}"`,
      l.requestId || ''
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="security-audit-logs.csv"');
    return res.status(HTTP_STATUS.OK).send(csv);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
  exportAuditLogsCsv
};
