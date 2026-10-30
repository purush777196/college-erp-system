const express = require('express');
const {
  getFacultyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = require('./notification.controller');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.FACULTY, ROLES.SUPER_ADMIN));

router.get('/', getFacultyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:notificationId/read', markNotificationAsRead);

module.exports = router;
