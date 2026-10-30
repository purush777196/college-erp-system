const express = require('express');
const {
  getSubjectSyllabus,
  updateUnitProgress,
  listFacultySyllabusProgress
} = require('./syllabus.controller');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);

router.get(
  '/faculty/summary',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  listFacultySyllabusProgress
);

router.get(
  '/subject/:subjectId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT),
  getSubjectSyllabus
);

router.patch(
  '/subject/:subjectId/unit/:unitNumber',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  updateUnitProgress
);

module.exports = router;
