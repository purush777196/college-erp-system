const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const Faculty = require('../src/modules/faculty/faculty.model');
const { CalendarEvent } = require('../src/modules/calendar/calendar.model');
const { FacultyNotification } = require('../src/modules/notifications/notification.model');
const { Appointment } = require('../src/modules/appointments/appointment.model');
const { Assignment } = require('../src/modules/assignments/assignment.model');
const Examination = require('../src/modules/examinations/exam.model');
const Timetable = require('../src/modules/timetable/timetable.model');
const Notice = require('../src/modules/notices/notice.model');
const { checkDueReminders } = require('../src/modules/notifications/reminder.scheduler');

describe('Academic Calendar & Reminders Test Suite (Phase 6)', () => {
  const facultyUser = {
    _id: '507f1f77bcf86cd799439002',
    name: 'Dr. Alan Turing',
    email: 'faculty.turing@college.edu',
    role: ROLES.FACULTY,
    status: 'active'
  };

  const otherFacultyUser = {
    _id: '507f1f77bcf86cd799439009',
    name: 'Prof. Other',
    email: 'faculty.other@college.edu',
    role: ROLES.FACULTY,
    status: 'active'
  };

  const studentUser = {
    _id: '507f1f77bcf86cd799439003',
    name: 'Student User',
    email: 'student@college.edu',
    role: ROLES.STUDENT,
    status: 'active'
  };

  const facultyDocId = '507f1f77bcf86cd799439010';
  const otherFacultyDocId = '507f1f77bcf86cd799439019';

  const facultyToken = jwt.sign(
    { id: facultyUser._id, role: facultyUser.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const otherFacultyToken = jwt.sign(
    { id: otherFacultyUser._id, role: otherFacultyUser.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { id: studentUser._id, role: studentUser.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(User, 'findById').mockImplementation((id) => ({
      select: () => {
        const idStr = String(id);
        if (idStr === String(facultyUser._id)) return Promise.resolve(facultyUser);
        if (idStr === String(otherFacultyUser._id)) return Promise.resolve(otherFacultyUser);
        if (idStr === String(studentUser._id)) return Promise.resolve(studentUser);
        return Promise.resolve(null);
      }
    }));

    jest.spyOn(Faculty, 'findOne').mockImplementation((query) => {
      const qUser = query?.user || query?.$or?.find((x) => x.user)?.user;
      const qId = query?._id || query?.$or?.find((x) => x._id)?._id;
      if (String(qUser) === String(facultyUser._id) || String(qId) === String(facultyDocId)) {
        return Promise.resolve({
          _id: facultyDocId,
          user: facultyUser._id,
          department: { _id: '507f1f77bcf86cd799439050', name: 'Computer Science' }
        });
      }
      if (String(qUser) === String(otherFacultyUser._id) || String(qId) === String(otherFacultyDocId)) {
        return Promise.resolve({
          _id: otherFacultyDocId,
          user: otherFacultyUser._id,
          department: { _id: '507f1f77bcf86cd799439060', name: 'Electronics' }
        });
      }
      return Promise.resolve(null);
    });

    jest.spyOn(Faculty, 'findById').mockImplementation((id) => {
      const profile = {
        _id: id,
        user: facultyUser._id,
        department: { _id: '507f1f77bcf86cd799439050', name: 'Computer Science' }
      };
      return {
        populate: () => ({
          lean: () => Promise.resolve(profile),
          then: (resolve) => resolve(profile)
        }),
        lean: () => Promise.resolve(profile),
        then: (resolve) => resolve(profile)
      };
    });
  });

  // 1. Faculty can create a personal event
  it('1. Faculty can create a personal event', async () => {
    const mockCreated = {
      _id: '507f1f77bcf86cd799439111',
      faculty: facultyDocId,
      title: 'Department Curriculum Meeting',
      description: 'Discuss upcoming semester course structures',
      category: 'Department Meeting',
      startDate: new Date('2026-11-10T10:00:00Z'),
      endDate: new Date('2026-11-10T11:30:00Z'),
      allDay: false,
      location: 'Conference Room 3B',
      priority: 'normal',
      status: 'scheduled',
      reminders: [{ intervalMinutes: 30, label: '30 min before', isDelivered: false }],
      createdAt: new Date()
    };

    jest.spyOn(CalendarEvent, 'create').mockResolvedValue(mockCreated);

    const res = await request(app)
      .post('/api/v1/faculty/me/calendar/events')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Department Curriculum Meeting',
        description: 'Discuss upcoming semester course structures',
        category: 'Department Meeting',
        startDate: '2026-11-10T10:00:00Z',
        endDate: '2026-11-10T11:30:00Z',
        allDay: false,
        location: 'Conference Room 3B',
        priority: 'normal',
        reminders: [{ intervalMinutes: 30, label: '30 min before' }]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.event.title).toBe('Department Curriculum Meeting');
    expect(res.body.data.event.isPersonalEvent).toBe(true);
  });

  // 2. Faculty can retrieve their own events
  it('2. Faculty can retrieve their own events in aggregated calendar', async () => {
    const mockPersonalEvents = [
      {
        _id: '507f1f77bcf86cd799439111',
        faculty: facultyDocId,
        title: 'Personal Study Session',
        category: 'Personal Events',
        startDate: new Date('2026-11-10T10:00:00Z'),
        endDate: new Date('2026-11-10T11:00:00Z'),
        status: 'scheduled'
      }
    ];

    jest.spyOn(CalendarEvent, 'find').mockReturnValue({
      lean: () => Promise.resolve(mockPersonalEvents)
    });
    jest.spyOn(Assignment, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Examination, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Appointment, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Timetable, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Notice, 'find').mockReturnValue({
      lean: () => Promise.resolve([])
    });

    const res = await request(app)
      .get('/api/v1/faculty/me/calendar/events?startDate=2026-11-01&endDate=2026-11-30')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.events.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.events[0].title).toBe('Personal Study Session');
  });

  // 3. Faculty can edit their own events
  it('3. Faculty can edit their own events', async () => {
    const mockEvent = {
      _id: '507f1f77bcf86cd799439111',
      faculty: facultyDocId,
      title: 'Old Title',
      description: 'Old Description',
      startDate: new Date('2026-11-10T10:00:00Z'),
      endDate: new Date('2026-11-10T11:00:00Z'),
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(CalendarEvent, 'findById').mockResolvedValue(mockEvent);

    const res = await request(app)
      .patch('/api/v1/faculty/me/calendar/events/507f1f77bcf86cd799439111')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Updated Event Title',
        priority: 'urgent'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockEvent.title).toBe('Updated Event Title');
    expect(mockEvent.priority).toBe('urgent');
    expect(mockEvent.save).toHaveBeenCalled();
  });

  // 4. Faculty can delete their own events
  it('4. Faculty can delete their own events', async () => {
    const mockEvent = {
      _id: '507f1f77bcf86cd799439111',
      faculty: facultyDocId,
      title: 'To Be Deleted'
    };

    jest.spyOn(CalendarEvent, 'findById').mockResolvedValue(mockEvent);
    jest.spyOn(CalendarEvent, 'findByIdAndDelete').mockResolvedValue(mockEvent);
    jest.spyOn(FacultyNotification, 'deleteMany').mockResolvedValue({ deletedCount: 1 });

    const res = await request(app)
      .delete('/api/v1/faculty/me/calendar/events/507f1f77bcf86cd799439111')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(CalendarEvent.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439111');
  });

  // 5. Faculty cannot access another faculty member's events
  it("5. Faculty cannot access another faculty member's events (IDOR protection)", async () => {
    const mockOtherEvent = {
      _id: '507f1f77bcf86cd799439111',
      faculty: otherFacultyDocId, // Belongs to other faculty
      title: 'Private Other Faculty Event'
    };

    jest.spyOn(CalendarEvent, 'findById').mockResolvedValue(mockOtherEvent);

    const res = await request(app)
      .get('/api/v1/faculty/me/calendar/events/507f1f77bcf86cd799439111')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // 6. Invalid date ranges are rejected
  it('6. Invalid date ranges are rejected', async () => {
    const res = await request(app)
      .post('/api/v1/faculty/me/calendar/events')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Invalid Event',
        startDate: '2026-11-10T12:00:00Z',
        endDate: '2026-11-10T10:00:00Z' // End date before start date!
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/End date\/time must be on or after start date\/time/i);
  });

  // 7. Invalid reminder configuration is rejected
  it('7. Invalid reminder configuration is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/faculty/me/calendar/events')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Invalid Reminder Event',
        startDate: '2026-11-10T10:00:00Z',
        endDate: '2026-11-10T11:00:00Z',
        reminders: [{ intervalMinutes: -15 }] // Negative interval!
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Reminder interval must be between 1 and 43200/i);
  });

  // 8. Source assignment events cannot be deleted through personal event APIs
  it('8. Source assignment events cannot be deleted through personal event APIs', async () => {
    const res = await request(app)
      .delete('/api/v1/faculty/me/calendar/events/assignment_507f1f77bcf86cd799439999')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Source records.*cannot be deleted/i);
  });

  // 9. Examination events are retrieved from actual records
  it('9. Examination events are retrieved from actual records', async () => {
    jest.spyOn(CalendarEvent, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });
    jest.spyOn(Assignment, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Appointment, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Timetable, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Notice, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });

    const mockExams = [
      {
        _id: '507f1f77bcf86cd799439222',
        name: 'Database Systems Midterm',
        examType: 'Mid-Term 1',
        academicYear: '2026-2027',
        semester: 4,
        venue: 'Room 401',
        startDate: new Date('2026-11-15T09:00:00Z'),
        endDate: new Date('2026-11-15T12:00:00Z'),
        status: 'scheduled'
      }
    ];

    jest.spyOn(Examination, 'find').mockReturnValue({
      populate: () => ({
        populate: () => ({
          lean: () => Promise.resolve(mockExams)
        })
      })
    });

    const res = await request(app)
      .get('/api/v1/faculty/me/calendar/events?startDate=2026-11-01&endDate=2026-11-30')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    const examEvent = res.body.data.events.find((e) => e.sourceType === 'examination');
    expect(examEvent).toBeDefined();
    expect(examEvent.title).toContain('Database Systems Midterm');
    expect(examEvent.isReadOnly).toBe(true);
    expect(examEvent.isPersonalEvent).toBe(false);
  });

  // 10. Timetable entries are retrieved from actual records
  it('10. Timetable entries are retrieved from actual records', async () => {
    jest.spyOn(CalendarEvent, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });
    jest.spyOn(Assignment, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Examination, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Appointment, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Notice, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });

    const mockTimetableSlots = [
      {
        _id: '507f1f77bcf86cd799439333',
        dayOfWeek: 'Monday',
        startTime: '10:00',
        endTime: '11:00',
        roomNumber: 'LH-101',
        periodNumber: 2,
        semester: 3,
        section: 'A',
        subject: { name: 'Algorithms', code: 'CS301' },
        course: { name: 'B.Tech CSE' }
      }
    ];

    jest.spyOn(Timetable, 'find').mockReturnValue({
      populate: () => ({
        populate: () => ({
          lean: () => Promise.resolve(mockTimetableSlots)
        })
      })
    });

    const res = await request(app)
      .get('/api/v1/faculty/me/calendar/events?startDate=2026-11-02&endDate=2026-11-09')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    const timetableEvent = res.body.data.events.find((e) => e.sourceType === 'timetable');
    expect(timetableEvent).toBeDefined();
    expect(timetableEvent.title).toContain('Algorithms');
    expect(timetableEvent.isReadOnly).toBe(true);
  });

  // 11. Appointment entries do not expose private faculty notes
  it('11. Appointment entries do not expose private faculty notes', async () => {
    jest.spyOn(CalendarEvent, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });
    jest.spyOn(Assignment, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Examination, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Timetable, 'find').mockReturnValue({
      populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) })
    });
    jest.spyOn(Notice, 'find').mockReturnValue({ lean: () => Promise.resolve([]) });

    const mockAppointments = [
      {
        _id: '507f1f77bcf86cd799439444',
        faculty: facultyDocId,
        date: '2026-11-12',
        startTime: '14:00',
        endTime: '14:30',
        title: 'Project Discussion',
        appointmentType: 'project_guidance',
        meetingMode: 'in_person',
        location: 'Cabin 204',
        status: 'approved',
        meetingNotes: {
          privateSummary: 'CONFIDENTIAL FACULTY EVALUATION NOTE: Student struggles with recursion'
        },
        student: {
          user: { firstName: 'Rohan', lastName: 'Verma' }
        }
      }
    ];

    jest.spyOn(Appointment, 'find').mockReturnValue({
      populate: () => ({
        populate: () => ({
          lean: () => Promise.resolve(mockAppointments)
        })
      })
    });

    const res = await request(app)
      .get('/api/v1/faculty/me/calendar/events?startDate=2026-11-01&endDate=2026-11-30')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    const aptEvent = res.body.data.events.find((e) => e.sourceType === 'appointment');
    expect(aptEvent).toBeDefined();
    // Verify privateSummary is NOT present anywhere in the returned JSON
    const jsonStr = JSON.stringify(aptEvent);
    expect(jsonStr).not.toContain('CONFIDENTIAL FACULTY EVALUATION NOTE');
    expect(aptEvent.meetingNotes).toBeUndefined();
  });

  // 12. Notifications are faculty-scoped
  it('12. Notifications are faculty-scoped', async () => {
    const mockNotifications = [
      {
        _id: '507f1f77bcf86cd799439555',
        recipient: facultyDocId,
        title: 'Upcoming Class Reminder',
        message: 'Your lecture on Algorithms starts in 10 minutes.',
        isRead: false,
        category: 'reminder'
      }
    ];

    jest.spyOn(FacultyNotification, 'find').mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve(mockNotifications)
          })
        })
      })
    });
    jest.spyOn(FacultyNotification, 'countDocuments').mockImplementation((query) => {
      if (query?.isRead === false) return Promise.resolve(1);
      return Promise.resolve(1);
    });

    const res = await request(app)
      .get('/api/v1/faculty/me/notifications')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications.length).toBe(1);
    expect(res.body.data.unreadCount).toBe(1);
  });

  // 13. Faculty can mark their own notification as read
  it('13. Faculty can mark their own notification as read', async () => {
    const mockNotification = {
      _id: '507f1f77bcf86cd799439555',
      recipient: facultyDocId,
      isRead: false,
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(FacultyNotification, 'findById').mockResolvedValue(mockNotification);
    jest.spyOn(FacultyNotification, 'countDocuments').mockResolvedValue(0);

    const res = await request(app)
      .patch('/api/v1/faculty/me/notifications/507f1f77bcf86cd799439555/read')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockNotification.isRead).toBe(true);
    expect(mockNotification.save).toHaveBeenCalled();
  });

  // 14. Faculty cannot mark another faculty member's notification as read
  it("14. Faculty cannot mark another faculty member's notification as read", async () => {
    const mockOtherNotification = {
      _id: '507f1f77bcf86cd799439555',
      recipient: otherFacultyDocId, // Belongs to other faculty
      isRead: false
    };

    jest.spyOn(FacultyNotification, 'findById').mockResolvedValue(mockOtherNotification);

    const res = await request(app)
      .patch('/api/v1/faculty/me/notifications/507f1f77bcf86cd799439555/read')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // 15. Duplicate reminders are prevented
  it('15. Duplicate reminders are prevented via idempotent reminderKey', async () => {
    const now = new Date();
    const eventStartDate = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins in future

    const mockEvent = {
      _id: '507f1f77bcf86cd799439666',
      faculty: facultyDocId,
      title: 'Idempotency Test Event',
      status: 'scheduled',
      startDate: eventStartDate,
      endDate: new Date(eventStartDate.getTime() + 60 * 60 * 1000),
      reminders: [{ intervalMinutes: 20, isDelivered: false, label: '20 min before' }],
      save: jest.fn().mockResolvedValue(true)
    };

    jest.spyOn(CalendarEvent, 'find').mockResolvedValue([mockEvent]);
    jest.spyOn(Appointment, 'find').mockReturnValue({ populate: () => Promise.resolve([]) });
    jest.spyOn(Assignment, 'find').mockResolvedValue([]);

    const updateOneSpy = jest.spyOn(FacultyNotification, 'updateOne').mockResolvedValue({
      upsertedCount: 1,
      matchedCount: 0
    });

    // Run scheduler check
    await checkDueReminders();

    expect(updateOneSpy).toHaveBeenCalled();
    const callArgs = updateOneSpy.mock.calls[0];
    // Filter must query by recipient and unique reminderKey
    expect(callArgs[0]).toEqual({
      recipient: facultyDocId,
      reminderKey: `event_${mockEvent._id}_20`
    });

    // Run scheduler check a second time: updateOne with $setOnInsert handles idempotency
    await checkDueReminders();
    expect(mockEvent.reminders[0].isDelivered).toBe(true);
  });

  // 16. Cancelled or deleted events do not trigger future reminders
  it('16. Cancelled or deleted events do not trigger future reminders', async () => {
    // CalendarEvent query filters by { status: 'scheduled' }
    const findSpy = jest.spyOn(CalendarEvent, 'find').mockResolvedValue([]);
    const updateOneSpy = jest.spyOn(FacultyNotification, 'updateOne');

    await checkDueReminders();

    // Verify find was called with status scheduled
    expect(findSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'scheduled'
      })
    );
    expect(updateOneSpy).not.toHaveBeenCalled();
  });

  // 17. Unauthorized roles cannot access faculty-only calendar APIs
  it('17. Unauthorized roles cannot access faculty-only calendar APIs', async () => {
    const res = await request(app)
      .get('/api/v1/faculty/me/calendar/events')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
