const mongoose = require('mongoose');
const { FacultyNotification } = require('./notification.model');
const Faculty = require('../faculty/faculty.model');
const { checkDueReminders } = require('./reminder.scheduler');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS } = require('@college-erp/shared');

// Helper to resolve Faculty document ID
async function getFacultyDocId(user) {
  if (user?.facultyId) return user.facultyId;
  try {
    const faculty = await Faculty.findOne({ user: user._id || user.id });
    if (faculty) return faculty._id;
  } catch (err) {
    // Ignore error
  }
  return user._id || user.id;
}

/**
 * List faculty-scoped notifications
 * GET /api/v1/faculty/me/notifications
 */
async function getFacultyNotifications(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);

    // Opportunistically run due reminders check
    checkDueReminders().catch(() => {});

    const { unreadOnly, category, limit = 50, page = 1 } = req.query;

    const query = { recipient: facId };
    if (unreadOnly === 'true' || unreadOnly === true) {
      query.isRead = false;
    }
    if (category) {
      query.category = category;
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [notifications, total, unreadCount] = await Promise.all([
      FacultyNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      FacultyNotification.countDocuments(query),
      FacultyNotification.countDocuments({ recipient: facId, isRead: false })
    ]);

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        total,
        unreadCount,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get unread notification count
 * GET /api/v1/faculty/me/notifications/unread-count
 */
async function getUnreadCount(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const count = await FacultyNotification.countDocuments({
      recipient: facId,
      isRead: false
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Unread count retrieved',
      data: {
        unreadCount: count
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark a single notification as read
 * PATCH /api/v1/faculty/me/notifications/:notificationId/read
 */
async function markNotificationAsRead(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const { notificationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid notification ID format'
      });
    }

    const notification = await FacultyNotification.findById(notificationId);
    if (!notification) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Notification not found'
      });
    }

    // Ownership check: must belong to the requesting faculty member
    if (notification.recipient.toString() !== facId.toString()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Access denied: You cannot modify notifications belonging to another faculty member'
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    const unreadCount = await FacultyNotification.countDocuments({
      recipient: facId,
      isRead: false
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Notification marked as read',
      data: {
        notification,
        unreadCount
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark all notifications as read
 * PATCH /api/v1/faculty/me/notifications/read-all
 */
async function markAllNotificationsAsRead(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);

    await FacultyNotification.updateMany(
      { recipient: facId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'All notifications marked as read',
      data: {
        unreadCount: 0
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getFacultyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getFacultyDocId
};
