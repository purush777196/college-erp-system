const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');
const departmentRoutes = require('../modules/departments/department.routes');
const courseRoutes = require('../modules/courses/course.routes');
const subjectRoutes = require('../modules/subjects/subject.routes');
const studentRoutes = require('../modules/students/student.routes');
const facultyRoutes = require('../modules/faculty/faculty.routes');
const timetableRoutes = require('../modules/timetable/timetable.routes');
const attendanceRoutes = require('../modules/attendance/attendance.routes');
const examRoutes = require('../modules/examinations/exam.routes');
const resultRoutes = require('../modules/results/result.routes');
const feeRoutes = require('../modules/fees/fee.routes');
const paymentRoutes = require('../modules/payments/payment.routes');
const noticeRoutes = require('../modules/notices/notice.routes');
const assignmentRoutes = require('../modules/assignments/assignment.routes');
const syllabusRoutes = require('../modules/syllabus/syllabus.routes');
const materialRoutes = require('../modules/materials/material.routes');
const reportRoutes = require('../modules/reports/report.routes');
const auditRoutes = require('../modules/audit-logs/audit.routes');
const { getAttendanceOverview, getDepartmentSummaries, getExaminationsReport } = require('../modules/reports/report.controller');
const authenticate = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

// Health Check
router.use('/health', healthRoutes);

// Versioned API v1 Router
const v1Router = express.Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/users', usersRoutes);
v1Router.use('/departments', departmentRoutes);
v1Router.get('/department-summaries', authenticate, getDepartmentSummaries);
v1Router.use('/courses', courseRoutes);
v1Router.use('/subjects', subjectRoutes);
v1Router.use('/students', studentRoutes);
v1Router.use('/faculty', facultyRoutes);
v1Router.use('/timetable', timetableRoutes);
v1Router.use('/attendance', attendanceRoutes);
v1Router.get(
  '/attendance-overview',
  authenticate,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  getAttendanceOverview
);
v1Router.get(
  ['/examination-reports', '/examinations-report'],
  authenticate,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.HOD),
  getExaminationsReport
);
v1Router.use('/examinations', examRoutes);
v1Router.use('/results', resultRoutes);
v1Router.use('/fees', feeRoutes);
v1Router.use('/payments', paymentRoutes);
v1Router.use('/notices', noticeRoutes);
v1Router.use('/assignments', assignmentRoutes);
v1Router.use('/syllabus', syllabusRoutes);
v1Router.use('/materials', materialRoutes);
v1Router.use('/reports', reportRoutes);
v1Router.use('/audit-logs', auditRoutes);

router.use('/v1', v1Router);

module.exports = router;
