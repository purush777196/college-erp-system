const { CalendarEvent } = require('../calendar/calendar.model');
const { FacultyNotification } = require('./notification.model');
const { Appointment } = require('../appointments/appointment.model');
const { Assignment } = require('../assignments/assignment.model');
const Examination = require('../examinations/exam.model');
const logger = require('../../utils/logger');

let schedulerTimer = null;
let isChecking = false;

/**
 * Scan database for due reminders and generate idempotent in-app notifications.
 */
async function checkDueReminders() {
  if (isChecking) return;
  isChecking = true;

  try {
    const now = new Date();

    // 1. Check Faculty Personal Calendar Events
    // Look for active events within the window: from 1 day in the past to 7 days in the future
    let personalEvents = [];
    try {
      const docs = await CalendarEvent.find({
        status: 'scheduled',
        'reminders.isDelivered': false,
        startDate: {
          $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      });
      if (Array.isArray(docs)) personalEvents = docs;
    } catch (e) {
      personalEvents = [];
    }

    for (const event of personalEvents) {
      if (!Array.isArray(event.reminders) || event.reminders.length === 0) continue;

      let eventModified = false;

      for (const reminder of event.reminders) {
        if (reminder.isDelivered) continue;

        const intervalMs = (reminder.intervalMinutes || 10) * 60 * 1000;
        const triggerTime = new Date(event.startDate.getTime() - intervalMs);

        // If the trigger time has arrived and event hasn't passed more than 2 hours ago
        if (now >= triggerTime && now <= new Date(event.endDate.getTime() + 2 * 60 * 60 * 1000)) {
          const reminderKey = `event_${event._id}_${reminder.intervalMinutes}`;

          try {
            await FacultyNotification.updateOne(
              { recipient: event.faculty, reminderKey },
              {
                $setOnInsert: {
                  recipient: event.faculty,
                  title: `Reminder: ${event.title}`,
                  message: `Your scheduled event "${event.title}" is coming up at ${new Date(
                    event.startDate
                  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${reminder.label || `${reminder.intervalMinutes} min before`}).`,
                  category: 'reminder',
                  priority: event.priority || 'normal',
                  relatedEntity: {
                    entityType: 'calendar_event',
                    entityId: event._id
                  },
                  reminderKey,
                  isRead: false
                }
              },
              { upsert: true }
            );

            reminder.isDelivered = true;
            eventModified = true;
          } catch (insertErr) {
            // E11000 duplicate key is expected if already created; mark delivered to prevent re-querying
            if (insertErr.code === 11000) {
              reminder.isDelivered = true;
              eventModified = true;
            } else {
              logger.warn(`Failed to insert notification for event ${event._id}:`, insertErr.message);
            }
          }
        }
      }

      if (eventModified) {
        await event.save().catch((saveErr) => {
          logger.warn(`Failed to update reminder delivery status for event ${event._id}:`, saveErr.message);
        });
      }
    }

    // 2. Check Upcoming Student Appointments (within 60 minutes)
    const todayStr = now.toISOString().slice(0, 10);
    let appointments = [];
    try {
      const docs = await Appointment.find({
        date: todayStr,
        status: 'approved'
      }).populate('faculty');
      if (Array.isArray(docs)) appointments = docs;
    } catch (e) {
      appointments = [];
    }

    for (const apt of appointments) {
      if (!apt.faculty || !apt.startTime) continue;
      const aptStart = new Date(`${apt.date}T${apt.startTime}:00`);
      const diffMinutes = Math.round((aptStart.getTime() - now.getTime()) / (60 * 1000));

      if (diffMinutes >= 0 && diffMinutes <= 60) {
        const reminderKey = `appointment_${apt._id}_60m`;
        try {
          await FacultyNotification.updateOne(
            { recipient: apt.faculty._id || apt.faculty, reminderKey },
            {
              $setOnInsert: {
                recipient: apt.faculty._id || apt.faculty,
                title: `Upcoming Consultation: ${apt.title}`,
                message: `You have an approved student appointment scheduled at ${apt.startTime} (${apt.meetingMode === 'online' ? 'Online' : apt.location || 'Faculty Cabin'}).`,
                category: 'appointment',
                priority: 'normal',
                relatedEntity: {
                  entityType: 'appointment',
                  entityId: apt._id
                },
                reminderKey,
                isRead: false
              }
            },
            { upsert: true }
          );
        } catch (aptErr) {
          if (aptErr.code !== 11000) {
            logger.warn(`Appointment reminder error for ${apt._id}:`, aptErr.message);
          }
        }
      }
    }

    // 3. Check Upcoming Assignment Submission Deadlines (within 24 hours)
    const assignmentThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let assignmentsDueSoon = [];
    try {
      const docs = await Assignment.find({
        status: { $in: ['published', 'active'] },
        dueDate: { $gte: now, $lte: assignmentThreshold }
      });
      if (Array.isArray(docs)) assignmentsDueSoon = docs;
    } catch (e) {
      assignmentsDueSoon = [];
    }

    for (const asgn of assignmentsDueSoon) {
      if (!asgn.faculty) continue;
      const reminderKey = `assignment_${asgn._id}_24h`;
      try {
        await FacultyNotification.updateOne(
          { recipient: asgn.faculty, reminderKey },
          {
            $setOnInsert: {
              recipient: asgn.faculty,
              title: `Assignment Due in 24h: ${asgn.title}`,
              message: `Student submission deadline for "${asgn.title}" closes on ${new Date(asgn.dueDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`,
              category: 'assignment',
              priority: 'normal',
              relatedEntity: {
                entityType: 'assignment',
                entityId: asgn._id
              },
              reminderKey,
              isRead: false
            }
          },
          { upsert: true }
        );
      } catch (asgnErr) {
        if (asgnErr.code !== 11000) {
          logger.warn(`Assignment reminder error for ${asgn._id}:`, asgnErr.message);
        }
      }
    }
  } catch (error) {
    logger.error('Error during reminder scheduler execution:', error);
  } finally {
    isChecking = false;
  }
}

/**
 * Start the singleton background reminder scheduler.
 * Runs once every 60 seconds safely.
 */
function startReminderScheduler(intervalMs = 60000) {
  if (schedulerTimer) {
    return; // Already running
  }

  // Trigger an initial check in the background
  checkDueReminders().catch((err) => {
    logger.warn('Initial reminder check error:', err.message);
  });

  schedulerTimer = setInterval(() => {
    checkDueReminders().catch((err) => {
      logger.warn('Background reminder check error:', err.message);
    });
  }, intervalMs);

  // Allow Node.js event loop to exit without waiting on this timer if needed
  if (schedulerTimer.unref) {
    schedulerTimer.unref();
  }

  logger.info(`Faculty Reminder Scheduler started (interval: ${intervalMs}ms)`);
}

/**
 * Stop the background scheduler.
 */
function stopReminderScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Faculty Reminder Scheduler stopped.');
  }
}

module.exports = {
  checkDueReminders,
  startReminderScheduler,
  stopReminderScheduler
};
