const mongoose = require('mongoose');
const { CalendarEvent, CALENDAR_CATEGORIES, EVENT_PRIORITIES } = require('./calendar.model');
const { FacultyNotification } = require('../notifications/notification.model');
const { getAggregatedCalendarEvents } = require('./calendar.service');
const Faculty = require('../faculty/faculty.model');
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
 * Get aggregated calendar events for the authenticated faculty member
 * GET /api/v1/faculty/me/calendar/events
 */
async function getCalendarEvents(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const { startDate, endDate, category, search } = req.query;

    const result = await getAggregatedCalendarEvents({
      facultyId: facId,
      startDate,
      endDate,
      category,
      search
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Calendar events retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new faculty personal calendar event
 * POST /api/v1/faculty/me/calendar/events
 */
async function createPersonalEvent(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const {
      title,
      description,
      category,
      startDate,
      endDate,
      allDay,
      location,
      priority,
      reminders
    } = req.body;

    // 1. Title validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Event title is required'
      });
    }
    if (title.trim().length > 200) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Event title cannot exceed 200 characters'
      });
    }

    // 2. Date validation
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Valid start date/time is required'
      });
    }
    if (!endDate || isNaN(new Date(endDate).getTime())) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Valid end date/time is required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'End date/time must be on or after start date/time'
      });
    }

    // 3. Category validation
    let validCategory = 'Personal Events';
    if (category) {
      if (!CALENDAR_CATEGORIES.includes(category)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: `Invalid category. Must be one of: ${CALENDAR_CATEGORIES.join(', ')}`
        });
      }
      validCategory = category;
    }

    // 4. Priority validation
    let validPriority = 'normal';
    if (priority) {
      if (!EVENT_PRIORITIES.includes(priority)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Priority must be low, normal, or urgent'
        });
      }
      validPriority = priority;
    }

    // 5. Reminders validation
    let validReminders = [];
    if (reminders && Array.isArray(reminders)) {
      for (const item of reminders) {
        const interval = parseInt(item.intervalMinutes, 10);
        if (isNaN(interval) || interval < 1 || interval > 43200) {
          return sendError(res, {
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Reminder interval must be between 1 and 43200 minutes (30 days)'
          });
        }
        validReminders.push({
          intervalMinutes: interval,
          label: item.label ? String(item.label).slice(0, 50) : `${interval} min before`,
          isDelivered: false
        });
      }
    }

    const newEvent = await CalendarEvent.create({
      faculty: facId,
      title: title.trim(),
      description: description ? String(description).slice(0, 2000).trim() : '',
      category: validCategory,
      startDate: start,
      endDate: end,
      allDay: Boolean(allDay),
      location: location ? String(location).slice(0, 200).trim() : '',
      priority: validPriority,
      status: 'scheduled',
      reminders: validReminders
    });

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Personal calendar event created successfully',
      data: {
        event: {
          id: newEvent._id.toString(),
          _id: newEvent._id.toString(),
          title: newEvent.title,
          description: newEvent.description,
          category: newEvent.category,
          startDate: newEvent.startDate,
          endDate: newEvent.endDate,
          allDay: newEvent.allDay,
          location: newEvent.location,
          priority: newEvent.priority,
          status: newEvent.status,
          reminders: newEvent.reminders,
          sourceType: 'personal',
          isPersonalEvent: true,
          isReadOnly: false,
          createdAt: newEvent.createdAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single event details by ID
 * GET /api/v1/faculty/me/calendar/events/:eventId
 */
async function getPersonalEventById(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid event ID format'
      });
    }

    const event = await CalendarEvent.findById(eventId);
    if (!event) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Calendar event not found'
      });
    }

    // Faculty ownership validation
    if (event.faculty.toString() !== facId.toString()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Access denied: You do not own this calendar event'
      });
    }

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Event details retrieved',
      data: {
        event: {
          id: event._id.toString(),
          _id: event._id.toString(),
          title: event.title,
          description: event.description,
          category: event.category,
          startDate: event.startDate,
          endDate: event.endDate,
          allDay: event.allDay,
          location: event.location,
          priority: event.priority,
          status: event.status,
          reminders: event.reminders,
          sourceType: 'personal',
          isPersonalEvent: true,
          isReadOnly: false,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update personal calendar event
 * PATCH /api/v1/faculty/me/calendar/events/:eventId
 */
async function updatePersonalEvent(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const { eventId } = req.params;

    // Check if client tried to pass a source prefix
    if (typeof eventId === 'string' && /^(assignment_|exam_|appointment_|timetable_|notice_)/.test(eventId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Source records (assignments, examinations, appointments, etc.) cannot be modified through the personal calendar API'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid event ID format'
      });
    }

    const event = await CalendarEvent.findById(eventId);
    if (!event) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Calendar event not found'
      });
    }

    // Ownership check
    if (event.faculty.toString() !== facId.toString()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Access denied: You do not own this calendar event'
      });
    }

    const {
      title,
      description,
      category,
      startDate,
      endDate,
      allDay,
      location,
      priority,
      status,
      reminders
    } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Title cannot be empty'
        });
      }
      if (title.trim().length > 200) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Title cannot exceed 200 characters'
        });
      }
      event.title = title.trim();
    }

    if (description !== undefined) {
      event.description = String(description).slice(0, 2000).trim();
    }

    if (category !== undefined) {
      if (!CALENDAR_CATEGORIES.includes(category)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid event category'
        });
      }
      event.category = category;
    }

    let start = event.startDate;
    let end = event.endDate;

    if (startDate !== undefined) {
      if (isNaN(new Date(startDate).getTime())) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid start date format'
        });
      }
      start = new Date(startDate);
      event.startDate = start;
    }

    if (endDate !== undefined) {
      if (isNaN(new Date(endDate).getTime())) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Invalid end date format'
        });
      }
      end = new Date(endDate);
      event.endDate = end;
    }

    if (end < start) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'End date/time must be on or after start date/time'
      });
    }

    if (allDay !== undefined) {
      event.allDay = Boolean(allDay);
    }

    if (location !== undefined) {
      event.location = String(location).slice(0, 200).trim();
    }

    if (priority !== undefined) {
      if (!EVENT_PRIORITIES.includes(priority)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Priority must be low, normal, or urgent'
        });
      }
      event.priority = priority;
    }

    if (status !== undefined) {
      if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.BAD_REQUEST,
          message: 'Status must be scheduled, completed, or cancelled'
        });
      }
      event.status = status;
    }

    if (reminders !== undefined && Array.isArray(reminders)) {
      const validReminders = [];
      for (const item of reminders) {
        const interval = parseInt(item.intervalMinutes, 10);
        if (isNaN(interval) || interval < 1 || interval > 43200) {
          return sendError(res, {
            statusCode: HTTP_STATUS.BAD_REQUEST,
            message: 'Reminder interval must be between 1 and 43200 minutes'
          });
        }
        validReminders.push({
          intervalMinutes: interval,
          label: item.label ? String(item.label).slice(0, 50) : `${interval} min before`,
          isDelivered: Boolean(item.isDelivered)
        });
      }
      event.reminders = validReminders;
    }

    await event.save();

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Event updated successfully',
      data: {
        event: {
          id: event._id.toString(),
          _id: event._id.toString(),
          title: event.title,
          description: event.description,
          category: event.category,
          startDate: event.startDate,
          endDate: event.endDate,
          allDay: event.allDay,
          location: event.location,
          priority: event.priority,
          status: event.status,
          reminders: event.reminders,
          sourceType: 'personal',
          isPersonalEvent: true,
          isReadOnly: false,
          updatedAt: event.updatedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete personal calendar event
 * DELETE /api/v1/faculty/me/calendar/events/:eventId
 */
async function deletePersonalEvent(req, res, next) {
  try {
    const facId = await getFacultyDocId(req.user);
    const { eventId } = req.params;

    // Check if client tried to pass a source prefix
    if (typeof eventId === 'string' && /^(assignment_|exam_|appointment_|timetable_|notice_)/.test(eventId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Source records (assignments, examinations, appointments, etc.) cannot be deleted through the personal calendar API'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return sendError(res, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid event ID format'
      });
    }

    const event = await CalendarEvent.findById(eventId);
    if (!event) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Calendar event not found'
      });
    }

    // Ownership check
    if (event.faculty.toString() !== facId.toString()) {
      return sendError(res, {
        statusCode: HTTP_STATUS.FORBIDDEN,
        message: 'Access denied: You do not own this calendar event'
      });
    }

    await CalendarEvent.findByIdAndDelete(eventId);

    // Clean up any unread reminder notifications for this deleted event
    await FacultyNotification.deleteMany({
      recipient: facId,
      'relatedEntity.entityId': eventId,
      isRead: false
    }).catch(() => {});

    return sendSuccess(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Event deleted successfully',
      data: {
        deletedEventId: eventId
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCalendarEvents,
  createPersonalEvent,
  getPersonalEventById,
  updatePersonalEvent,
  deletePersonalEvent,
  getFacultyDocId
};
