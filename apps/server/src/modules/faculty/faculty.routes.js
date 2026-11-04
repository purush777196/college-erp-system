const express = require('express');
const {
  listFaculty,
  getFacultyById,
  getMyFacultyProfile,
  createFacultyProfile,
  updateFacultyProfile,
  getFacultyDashboardStats
} = require('./faculty.controller');
const { validateFacultyInput } = require('./faculty.validator');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const validateRequest = require('../../middleware/validate');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);

router.get('/me', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getMyFacultyProfile);
router.get(
  '/dashboard-stats',
  authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL),
  getFacultyDashboardStats
);
router.get(
  '/stats',
  authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL),
  getFacultyDashboardStats
);
router.get(
  '/me/stats',
  authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL),
  getFacultyDashboardStats
);

router.get(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT),
  listFaculty
);
router.get(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT),
  getFacultyById
);

router.post(
  '/',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  validateRequest(validateFacultyInput),
  createFacultyProfile
);

router.put(
  '/:id',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  updateFacultyProfile
);

module.exports = router;
