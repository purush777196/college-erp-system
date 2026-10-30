const express = require('express');
const {
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
} = require('./syllabus.controller');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);

// 1. Faculty syllabus progress summaries
router.get(
  '/faculty/summary',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  listFacultySyllabusProgress
);

// 2. Unit-by-unit syllabus data
router.get(
  '/subject/:subjectId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY, ROLES.STUDENT),
  getSubjectSyllabus
);

// 3. Initialize default syllabus template
router.post(
  '/subject/:subjectId/initialize',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  initializeSubjectSyllabus
);

// 4. Detailed progress analytics & delay detection
router.get(
  '/subject/:subjectId/progress',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  getSyllabusProgressAnalytics
);

// 5. Syllabus progress update history
router.get(
  '/subject/:subjectId/history',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  getSyllabusHistory
);

// 6. Unit Management (CRUD)
router.post(
  '/subject/:subjectId/units',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  createUnit
);

router.put(
  '/subject/:subjectId/units/:unitId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  updateUnit
);

router.delete(
  '/subject/:subjectId/units/:unitId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  deleteUnit
);

// 7. Topic Management (CRUD)
router.post(
  '/subject/:subjectId/units/:unitId/topics',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  createTopic
);

router.put(
  '/subject/:subjectId/units/:unitId/topics/:topicId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  updateTopic
);

router.delete(
  '/subject/:subjectId/units/:unitId/topics/:topicId',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  deleteTopic
);

// 8. Legacy Unit Status PATCH (Maintained for full backward compatibility)
router.patch(
  '/subject/:subjectId/unit/:unitNumber',
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD, ROLES.FACULTY),
  updateUnitProgress
);

module.exports = router;
