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

const {
  getAnalyticsOverview,
  getSubjectAnalytics,
  getStudentPerformanceList,
  getStudentAnalyticsDetail,
  getAnalyticsTrends
} = require('./faculty-analytics.controller');

const router = express.Router();

router.use(authenticate);

// Faculty Self-Service & Student Performance Analytics
router.get('/me', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getMyFacultyProfile);
router.get('/me/activities', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getMyFacultyActivities);
router.get('/me/assigned-subjects', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getMyAssignedSubjects);
router.get('/me/assigned-subjects/:subjectId/students', authorizeRoles(ROLES.FACULTY, ROLES.HOD, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL), getAssignedSubjectStudents);

// Student Performance Analytics (Phase 2)
router.get('/me/analytics/overview', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getAnalyticsOverview);
router.get('/me/analytics/subjects', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getSubjectAnalytics);
router.get('/me/analytics/students', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getStudentPerformanceList);
router.get('/me/analytics/students/:studentId', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getStudentAnalyticsDetail);
router.get('/me/analytics/trends', authorizeRoles(ROLES.FACULTY, ROLES.HOD), getAnalyticsTrends);
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
