const express = require('express');
const {
  getCalendarEvents,
  createPersonalEvent,
  getPersonalEventById,
  updatePersonalEvent,
  deletePersonalEvent
} = require('./calendar.controller');
const authenticate = require('../../middleware/auth');
const { authorizeRoles } = require('../../middleware/rbac');
const { ROLES } = require('@college-erp/shared');

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.FACULTY, ROLES.SUPER_ADMIN));

router.get('/events', getCalendarEvents);
router.post('/events', createPersonalEvent);
router.get('/events/:eventId', getPersonalEventById);
router.patch('/events/:eventId', updatePersonalEvent);
router.delete('/events/:eventId', deletePersonalEvent);

module.exports = router;
