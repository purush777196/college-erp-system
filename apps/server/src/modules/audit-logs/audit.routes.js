const express = require('express');
const { listAuditLogs, getAuditLogById, exportAuditLogsCsv } = require('./audit.controller');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);

// Audit log querying permitted for administrative roles (Super Admin, Principal, HOD)
router.get(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  listAuditLogs
);

router.get(
  '/export',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL),
  exportAuditLogsCsv
);

router.get(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  getAuditLogById
);

module.exports = router;
