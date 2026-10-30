const express = require('express');
const {
  listFaculty,
  getFacultyById,
  getMyFacultyProfile,
  getMyFacultyActivities,
  getMyAssignedSubjects,
  getAssignedSubjectStudents,
  createFacultyProfile,
  updateFacultyProfile
} = require('./faculty.controller');
const { validateFacultyInput } = require('./faculty.validator');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const validateRequest = require('../../middleware/validate');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);

router.get('/me', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getMyFacultyProfile);
router.get('/me/activities', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getMyFacultyActivities);
router.get('/me/assigned-subjects', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getMyAssignedSubjects);
router.get('/me/assigned-subjects/:subjectId/students', authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL), getAssignedSubjectStudents);
router.get('/', listFaculty);
router.get('/:id', getFacultyById);

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
