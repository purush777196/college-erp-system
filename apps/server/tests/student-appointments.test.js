const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const Faculty = require('../src/modules/faculty/faculty.model');
const Student = require('../src/modules/students/student.model');
const Timetable = require('../src/modules/timetable/timetable.model');
const { Appointment } = require('../src/modules/appointments/appointment.model');
const { FacultyAvailability } = require('../src/modules/appointments/faculty-availability.model');
const { doIntervalsOverlap, checkAppointmentConflicts } = require('../src/modules/appointments/appointment-conflict.service');

describe('Student Appointment System Test Suite (Phase 5)', () => {
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
    name: 'Aarav Sharma',
    email: 'student.aarav@college.edu',
    role: ROLES.STUDENT,
    status: 'active'
  };

  const otherStudentUser = {
    _id: '507f1f77bcf86cd799439004',
    name: 'Sneha Patel',
    email: 'student.sneha@college.edu',
    role: ROLES.STUDENT,
    status: 'active'
  };

  const facultyDocId = '507f1f77bcf86cd799439010';
  const otherFacultyDocId = '507f1f77bcf86cd799439019';
  const studentDocId = '507f1f77bcf86cd799439030';
  const otherStudentDocId = '507f1f77bcf86cd799439031';
  const mockSubjectId = '507f1f77bcf86cd799439020';

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

  const otherStudentToken = jwt.sign(
    { id: otherStudentUser._id, role: otherStudentUser.role },
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
        if (idStr === String(otherStudentUser._id)) return Promise.resolve(otherStudentUser);
        return Promise.resolve(null);
      }
    }));

    jest.spyOn(Faculty, 'findOne').mockImplementation((query) => {
      const qUser = query?.user || query?.$or?.find((x) => x.user)?.user;
      const qId = query?._id || query?.$or?.find((x) => x._id)?._id;
      if (String(qUser) === String(facultyUser._id) || String(qId) === String(facultyDocId)) {
        return Promise.resolve({ _id: facultyDocId, user: facultyUser._id, department: '507f1f77bcf86cd799439050' });
      }
      if (String(qUser) === String(otherFacultyUser._id) || String(qId) === String(otherFacultyDocId)) {
        return Promise.resolve({ _id: otherFacultyDocId, user: otherFacultyUser._id, department: '507f1f77bcf86cd799439060' });
      }
      return Promise.resolve(null);
    });

    jest.spyOn(Student, 'findOne').mockImplementation((query) => {
      const qUser = query?.user || query?.$or?.find((x) => x.user)?.user;
      const qId = query?._id || query?.$or?.find((x) => x._id)?._id;
      if (String(qUser) === String(studentUser._id) || String(qId) === String(studentDocId)) {
        return Promise.resolve({ _id: studentDocId, user: studentUser._id, rollNumber: 'CS2026-001', department: '507f1f77bcf86cd799439050' });
      }
      if (String(qUser) === String(otherStudentUser._id) || String(qId) === String(otherStudentDocId)) {
        return Promise.resolve({ _id: otherStudentDocId, user: otherStudentUser._id, rollNumber: 'CS2026-002', department: '507f1f77bcf86cd799439050' });
      }
      return Promise.resolve(null);
    });

    jest.spyOn(Appointment, 'find').mockImplementation(() => {
      const promise = Promise.resolve([]);
      promise.select = () => promise;
      promise.populate = () => promise;
      promise.sort = () => promise;
      promise.skip = () => promise;
      promise.limit = () => promise;
      promise.lean = () => Promise.resolve([]);
      return promise;
    });

    jest.spyOn(Timetable, 'find').mockImplementation(() => {
      const promise = Promise.resolve([]);
      promise.populate = () => promise;
      promise.lean = () => Promise.resolve([]);
      return promise;
    });

    jest.spyOn(Timetable, 'findOne').mockResolvedValue(null);
    jest.spyOn(FacultyAvailability, 'findOne').mockResolvedValue(null);
  });

  describe('Conflict Detection Logic', () => {
    it('detects interval overlap correctly', () => {
      // Slot 1: 10:00 - 11:00 (600 - 660), Slot 2: 10:30 - 11:30 (630 - 690) -> OVERLAP
      expect(doIntervalsOverlap('10:00', '11:00', '10:30', '11:30')).toBe(true);

      // Slot 1: 10:00 - 10:30, Slot 2: 10:30 - 11:00 -> NO OVERLAP (contiguous boundary)
      expect(doIntervalsOverlap('10:00', '10:30', '10:30', '11:00')).toBe(false);

      // Slot 1: 14:00 - 15:00, Slot 2: 09:00 - 10:00 -> NO OVERLAP
      expect(doIntervalsOverlap('14:00', '15:00', '09:00', '10:00')).toBe(false);

      // Slot 1: 10:00 - 12:00, Slot 2: 10:30 - 11:00 -> OVERLAP (contained)
      expect(doIntervalsOverlap('10:00', '12:00', '10:30', '11:00')).toBe(true);
    });

    it('rejects appointments when start time is after end time', async () => {
      const result = await checkAppointmentConflicts({
        facultyId: facultyDocId,
        studentId: studentDocId,
        dateStr: '2026-11-02',
        startTime: '14:00',
        endTime: '13:00'
      });
      expect(result.hasConflict).toBe(true);
      expect(result.type).toBe('INVALID_TIME');
    });
  });

  describe('Faculty Availability Management', () => {
    it('returns faculty availability or initializes default', async () => {
      jest.spyOn(FacultyAvailability, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(FacultyAvailability, 'create').mockResolvedValueOnce({
        faculty: facultyDocId,
        weeklyAvailability: [{ dayOfWeek: 'Monday', isActive: true, slots: [{ startTime: '10:00', endTime: '12:00' }] }],
        breakPeriods: [{ dayOfWeek: 'Monday', startTime: '13:00', endTime: '14:00', label: 'Lunch' }],
        appointmentDuration: 30
      });

      const res = await request(app)
        .get('/api/v1/faculty/me/appointments/availability')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('updates faculty availability configuration', async () => {
      const mockAvail = {
        faculty: facultyDocId,
        weeklyAvailability: [],
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(FacultyAvailability, 'findOne').mockResolvedValueOnce(mockAvail);

      const res = await request(app)
        .put('/api/v1/faculty/me/appointments/availability')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          appointmentDuration: 45,
          maximumAppointmentsPerDay: 6,
          defaultLocation: 'Room 304, CS Dept'
        });

      expect(res.status).toBe(200);
      expect(mockAvail.save).toHaveBeenCalled();
      expect(mockAvail.appointmentDuration).toBe(45);
      expect(mockAvail.maximumAppointmentsPerDay).toBe(6);
    });

    it('rejects student role from modifying faculty availability', async () => {
      const res = await request(app)
        .put('/api/v1/faculty/me/appointments/availability')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ appointmentDuration: 45 });

      expect(res.status).toBe(403);
    });
  });

  describe('Appointment Booking & Conflict Prevention', () => {
    it('creates a valid student appointment request', async () => {
      jest.spyOn(Appointment, 'find').mockResolvedValue([]);
      jest.spyOn(Timetable, 'find').mockResolvedValue([]);
      jest.spyOn(FacultyAvailability, 'findOne').mockResolvedValue(null);

      jest.spyOn(Appointment, 'create').mockResolvedValueOnce({
        _id: '507f1f77bcf86cd799439080',
        student: studentDocId,
        faculty: facultyDocId,
        title: 'Doubt on Dynamic Programming',
        appointmentType: 'academic_doubt',
        date: '2026-11-02',
        startTime: '10:00',
        endTime: '10:30',
        status: 'pending'
      });

      const res = await request(app)
        .post('/api/v1/student/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          facultyId: facultyDocId,
          subjectId: mockSubjectId,
          title: 'Doubt on Dynamic Programming',
          appointmentType: 'academic_doubt',
          description: 'Need help with memoization table in 0/1 knapsack.',
          date: '2026-11-02',
          startTime: '10:00',
          endTime: '10:30',
          meetingMode: 'in_person'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });

    it('rejects student appointment when faculty has conflicting appointment', async () => {
      jest.spyOn(Appointment, 'find').mockResolvedValueOnce([
        {
          _id: '507f1f77bcf86cd799439099',
          title: 'Existing Review',
          startTime: '10:00',
          endTime: '11:00',
          status: 'approved'
        }
      ]);

      const res = await request(app)
        .post('/api/v1/student/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          facultyId: facultyDocId,
          title: 'Overlapping Appointment',
          description: 'Clash test',
          date: '2026-11-02',
          startTime: '10:30',
          endTime: '11:00'
        });

      expect(res.status).toBe(409);
      expect(res.body.error?.code || res.body.code).toBe('FACULTY_OVERLAP');
    });
  });

  describe('Appointment Approval & Lifecycle', () => {
    it('allows faculty to approve pending appointment', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        faculty: facultyDocId,
        student: studentDocId,
        date: '2026-11-02',
        startTime: '10:00',
        endTime: '10:30',
        status: 'pending',
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValueOnce(mockApp);
      jest.spyOn(Appointment, 'find').mockResolvedValue([]);
      jest.spyOn(Timetable, 'find').mockResolvedValue([]);
      jest.spyOn(FacultyAvailability, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/faculty/me/appointments/507f1f77bcf86cd799439080/approve')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ location: 'Faculty Room 204' });

      expect(res.status).toBe(200);
      expect(mockApp.status).toBe('approved');
      expect(mockApp.approvedBy).toBe(facultyUser._id);
      expect(mockApp.history.length).toBe(1);
      expect(mockApp.history[0].newStatus).toBe('approved');
    });

    it('prevents another faculty member from approving requests (cross-faculty IDOR protection)', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        faculty: facultyDocId, // Assigned to Turing, not Other
        student: studentDocId,
        status: 'pending'
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValueOnce(mockApp);

      const res = await request(app)
        .patch('/api/v1/faculty/me/appointments/507f1f77bcf86cd799439080/approve')
        .set('Authorization', `Bearer ${otherFacultyToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('rejects an appointment with reason recorded', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        faculty: facultyDocId,
        status: 'pending',
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValueOnce(mockApp);

      const res = await request(app)
        .patch('/api/v1/faculty/me/appointments/507f1f77bcf86cd799439080/reject')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ reason: 'Faculty on official leave' });

      expect(res.status).toBe(200);
      expect(mockApp.status).toBe('rejected');
      expect(mockApp.rejectionReason).toBe('Faculty on official leave');
    });

    it('reschedules an appointment while checking conflicts and preserving history', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        faculty: facultyDocId,
        student: studentDocId,
        date: '2026-11-02',
        startTime: '10:00',
        endTime: '10:30',
        status: 'approved',
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValueOnce(mockApp);
      jest.spyOn(Appointment, 'find').mockResolvedValue([]);
      jest.spyOn(Timetable, 'find').mockResolvedValue([]);
      jest.spyOn(FacultyAvailability, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/faculty/me/appointments/507f1f77bcf86cd799439080/reschedule')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          newDate: '2026-11-03',
          newStartTime: '14:00',
          newEndTime: '14:30',
          reason: 'Department meeting rescheduled'
        });

      expect(res.status).toBe(200);
      expect(mockApp.status).toBe('rescheduled');
      expect(mockApp.date).toBe('2026-11-03');
      expect(mockApp.startTime).toBe('14:00');
      expect(mockApp.rescheduledFrom.date).toBe('2026-11-02');
    });

    it('marks an approved appointment as completed', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        faculty: facultyDocId,
        status: 'approved',
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValueOnce(mockApp);

      const res = await request(app)
        .patch('/api/v1/faculty/me/appointments/507f1f77bcf86cd799439080/complete')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(mockApp.status).toBe('completed');
    });
  });

  describe('Private Meeting Notes Privacy & Summary', () => {
    it('saves private meeting notes for faculty', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        faculty: facultyDocId,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValueOnce(mockApp);

      const res = await request(app)
        .post('/api/v1/faculty/me/appointments/507f1f77bcf86cd799439080/notes')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          privateSummary: 'Student has foundational confusion on tree traversal recursions.',
          discussionTopics: ['Binary Tree', 'Inorder Traversal'],
          actionItems: ['Solve LeetCode #94', 'Review lecture 12'],
          followUpRequired: true,
          followUpDate: '2026-11-10'
        });

      expect(res.status).toBe(200);
      expect(mockApp.meetingNotes.privateSummary).toContain('tree traversal');
      expect(mockApp.meetingNotes.followUpRequired).toBe(true);
    });

    it('returns appointment summary counts for faculty dashboard', async () => {
      jest.spyOn(Appointment, 'find').mockReturnValueOnce({
        select: () => ({
          lean: () =>
            Promise.resolve([
              { status: 'pending', date: '2026-11-02' },
              { status: 'approved', date: '2026-11-02' },
              { status: 'completed', date: '2026-10-25' },
              { status: 'cancelled', date: '2026-10-26' }
            ])
        })
      });

      const res = await request(app)
        .get('/api/v1/faculty/me/appointments/summary')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(4);
      expect(res.body.data.pending).toBe(1);
      expect(res.body.data.approved).toBe(1);
      expect(res.body.data.completed).toBe(1);
      expect(res.body.data.cancelledOrRejected).toBe(1);
    });
  });

  describe('Student Dashboard Appointment Integration & Privacy', () => {
    it('allows student to retrieve their own appointments', async () => {
      jest.spyOn(Appointment, 'find').mockReturnValueOnce({
        select: () => ({
          populate: () => ({
            populate: () => ({
              sort: () => ({
                skip: () => ({
                  limit: () => ({
                    lean: () =>
                      Promise.resolve([
                        {
                          _id: '507f1f77bcf86cd799439080',
                          title: 'Doubt on Dynamic Programming',
                          status: 'pending',
                          date: '2026-11-02',
                          startTime: '10:00',
                          endTime: '10:30'
                        }
                      ])
                  })
                })
              })
            })
          })
        })
      });
      jest.spyOn(Appointment, 'countDocuments').mockResolvedValueOnce(1);

      const res = await request(app)
        .get('/api/v1/student/appointments')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Doubt on Dynamic Programming');
    });

    it('prevents student from accessing another student appointment (IDOR 403)', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        student: studentDocId, // Belongs to Aarav
        faculty: facultyDocId,
        populate: function() { return this; },
        toObject: function() { return { ...this }; }
      };

      jest.spyOn(Appointment, 'findById').mockReturnValueOnce({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => Promise.resolve(mockApp)
            })
          })
        })
      });

      // Sneha attempts to access Aarav's appointment
      const res = await request(app)
        .get('/api/v1/student/appointments/507f1f77bcf86cd799439080')
        .set('Authorization', `Bearer ${otherStudentToken}`);

      expect(res.status).toBe(403);
    });

    it('completely strips private faculty notes from student appointment detail response', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        student: studentDocId,
        faculty: facultyDocId,
        title: 'Project Consultation',
        status: 'approved',
        meetingNotes: {
          privateSummary: 'CONFIDENTIAL: Student needs remedial attention in algorithmic analysis.',
          discussionTopics: ['Graphs', 'Shortest Paths'],
          actionItems: ['Read chapter 4']
        },
        populate: function() { return this; },
        toObject: function() {
          return {
            _id: this._id,
            student: this.student,
            faculty: this.faculty,
            title: this.title,
            status: this.status,
            meetingNotes: { ...this.meetingNotes }
          };
        }
      };

      jest.spyOn(Appointment, 'findById').mockReturnValueOnce({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              populate: () => Promise.resolve(mockApp)
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/student/appointments/507f1f77bcf86cd799439080')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meetingNotes).toBeDefined();
      expect(res.body.data.meetingNotes.privateSummary).toBeUndefined();
      expect(res.body.data.meetingNotes.discussionTopics).toEqual(['Graphs', 'Shortest Paths']);
    });

    it('rejects student booking with an unrelated faculty member (403)', async () => {
      // Mock student in Dept A and faculty in Dept B with no timetable link
      jest.spyOn(Student, 'findOne').mockResolvedValueOnce({
        _id: studentDocId,
        department: '507f1f77bcf86cd799439050',
        currentSemester: 3
      });
      jest.spyOn(Faculty, 'findOne').mockResolvedValueOnce({
        _id: otherFacultyDocId,
        department: '507f1f77bcf86cd799439060' // Different department
      });
      jest.spyOn(Timetable, 'findOne').mockResolvedValueOnce(null); // No class link

      const res = await request(app)
        .post('/api/v1/student/appointments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          facultyId: otherFacultyDocId,
          title: 'Unrelated Consultation',
          appointmentType: 'academic_doubt',
          description: 'Help with unrelated subject',
          date: '2026-11-04',
          startTime: '11:00',
          endTime: '11:30'
        });

      expect(res.status).toBe(403);
    });

    it('returns appointment summary counts for student dashboard', async () => {
      jest.spyOn(Appointment, 'countDocuments').mockImplementation((query) => {
        if (!query.status) return Promise.resolve(5);
        if (query.status === 'pending') return Promise.resolve(2);
        if (query.status?.$in?.includes('approved') && query.date) return Promise.resolve(1);
        if (query.status?.$in?.includes('approved')) return Promise.resolve(2);
        if (query.status === 'completed') return Promise.resolve(1);
        if (query.status?.$in?.includes('cancelled')) return Promise.resolve(0);
        return Promise.resolve(0);
      });

      const res = await request(app)
        .get('/api/v1/student/appointments/summary')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(5);
      expect(res.body.data.pending).toBe(2);
      expect(res.body.data.approved).toBe(2);
    });

    it('allows student to cancel their own appointment', async () => {
      const mockApp = {
        _id: '507f1f77bcf86cd799439080',
        student: studentDocId,
        faculty: facultyDocId,
        status: 'pending',
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValueOnce(mockApp);

      const res = await request(app)
        .patch('/api/v1/student/appointments/507f1f77bcf86cd799439080/cancel')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reason: 'Personal emergency' });

      expect(res.status).toBe(200);
      expect(mockApp.status).toBe('cancelled');
      expect(mockApp.cancellationReason).toBe('Personal emergency');
    });
  });
});
