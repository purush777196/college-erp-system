const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const AuditLog = require('../src/modules/audit-logs/audit.model');
const Attendance = require('../src/modules/attendance/attendance.model');
const Result = require('../src/modules/results/result.model');
const Student = require('../src/modules/students/student.model');
const Faculty = require('../src/modules/faculty/faculty.model');
const Timetable = require('../src/modules/timetable/timetable.model');
const Subject = require('../src/modules/subjects/subject.model');
const SyllabusProgress = require('../src/modules/syllabus/syllabus.model');
const { Assignment } = require('../src/modules/assignments/assignment.model');

describe('Faculty Enhancements Test Suite', () => {
  const facultyUser = {
    _id: '507f1f77bcf86cd799439002',
    name: 'Dr. Alan Turing',
    email: 'faculty.turing@college.edu',
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

  const facultyToken = jwt.sign(
    { id: facultyUser._id, role: facultyUser.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const studentToken = jwt.sign(
    { id: studentUser._id, role: studentUser.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      if (idStr === facultyUser._id) return { select: jest.fn().mockResolvedValue(facultyUser) };
      if (idStr === studentUser._id) return { select: jest.fn().mockResolvedValue(studentUser) };
      return { select: jest.fn().mockResolvedValue(null) };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Faculty Self-Scoped Activity Stream', () => {
    it('GET /api/v1/faculty/me/activities returns 200 and audit logs for authenticated faculty', async () => {
      jest.spyOn(AuditLog, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: '607f1f77bcf86cd799439099',
                user: facultyUser._id,
                action: 'ATTENDANCE_MARKED',
                entityType: 'Attendance',
                details: { periodNumber: 1, count: 25 },
                createdAt: new Date().toISOString()
              }
            ])
          })
        })
      });

      const res = await request(app)
        .get('/api/v1/faculty/me/activities')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('ATTENDANCE_MARKED');
    });

    it('GET /api/v1/faculty/me/activities rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/faculty/me/activities');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/faculty/me/activities rejects student requests with 403', async () => {
      const res = await request(app)
        .get('/api/v1/faculty/me/activities')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('2. Batch Attendance Recording', () => {
    it('POST /api/v1/attendance/batch persists batch roster attendance', async () => {
      jest.spyOn(Attendance, 'bulkWrite').mockResolvedValue({
        matchedCount: 2,
        modifiedCount: 2,
        upsertedCount: 0
      });

      const res = await request(app)
        .post('/api/v1/attendance/batch')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subject: '507f1f77bcf86cd799439020',
          date: '2026-10-30',
          periodNumber: 1,
          records: [
            { studentId: '507f1f77bcf86cd799439031', status: 'present', remarks: 'Good participation' },
            { studentId: '507f1f77bcf86cd799439032', status: 'absent', remarks: 'Medical leave' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.matchedCount).toBe(2);
    });

    it('POST /api/v1/attendance/batch rejects request without records array with 400', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/batch')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subject: '507f1f77bcf86cd799439020',
          date: '2026-10-30'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Batch Examination Marks Entry & Bounds Validation', () => {
    it('POST /api/v1/results/batch accepts valid marks within boundaries (0-40 internal, 0-60 external)', async () => {
      jest.spyOn(Result, 'bulkWrite').mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1,
        upsertedCount: 0
      });

      const res = await request(app)
        .post('/api/v1/results/batch')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          examination: '507f1f77bcf86cd799439040',
          subject: '507f1f77bcf86cd799439020',
          records: [
            { studentId: '507f1f77bcf86cd799439031', internalMarks: 36, externalMarks: 54 }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/results/batch rejects internal marks greater than 40 with 400', async () => {
      const res = await request(app)
        .post('/api/v1/results/batch')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          examination: '507f1f77bcf86cd799439040',
          subject: '507f1f77bcf86cd799439020',
          records: [
            { studentId: '507f1f77bcf86cd799439031', internalMarks: 45, externalMarks: 50 }
          ]
        });

      expect(res.status).toBe(400);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('MARKS_OUT_OF_BOUNDS');
    });

    it('POST /api/v1/results/batch rejects external marks greater than 60 with 400', async () => {
      const res = await request(app)
        .post('/api/v1/results/batch')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          examination: '507f1f77bcf86cd799439040',
          subject: '507f1f77bcf86cd799439020',
          records: [
            { studentId: '507f1f77bcf86cd799439031', internalMarks: 30, externalMarks: 75 }
          ]
        });

      expect(res.status).toBe(400);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('MARKS_OUT_OF_BOUNDS');
    });
  });

  describe('4. Student List Course Filtering', () => {
    it('GET /api/v1/students supports course filter query parameter', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          {
            _id: '507f1f77bcf86cd799439031',
            rollNumber: '24CSE001',
            currentSemester: 3,
            course: '507f1f77bcf86cd799439050'
          }
        ])
      };

      jest.spyOn(Student, 'find').mockReturnValue(mockQuery);
      jest.spyOn(Student, 'countDocuments').mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/students?course=507f1f77bcf86cd799439050')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('5. Faculty Assigned Subjects & Student Roster', () => {
    const mockFacultyDoc = {
      _id: '507f1f77bcf86cd799439004',
      user: facultyUser._id,
      employeeId: 'FAC-CSE-001',
      department: '507f1f77bcf86cd799439010'
    };

    const mockSubject = {
      _id: '507f1f77bcf86cd799439020',
      code: 'CS301',
      name: 'Data Structures & Algorithms',
      semester: 3,
      credits: 4,
      department: { _id: '507f1f77bcf86cd799439010', name: 'Computer Science', code: 'CSE' },
      course: { _id: '507f1f77bcf86cd799439050', name: 'B.Tech CSE', code: 'BTCSE' }
    };

    it('GET /api/v1/faculty/me/assigned-subjects returns 200 with merged sections and classrooms', async () => {
      jest.spyOn(Faculty, 'findOne').mockResolvedValue(mockFacultyDoc);

      const mockSlots = [
        {
          _id: '507f1f77bcf86cd799439071',
          dayOfWeek: 'Monday',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:50',
          roomNumber: 'LH-101',
          section: 'A',
          subject: mockSubject,
          department: mockSubject.department,
          course: mockSubject.course,
          semester: 3
        },
        {
          _id: '507f1f77bcf86cd799439072',
          dayOfWeek: 'Wednesday',
          periodNumber: 3,
          startTime: '11:00',
          endTime: '11:50',
          roomNumber: 'CS-Lab-1',
          section: 'A',
          subject: mockSubject,
          department: mockSubject.department,
          course: mockSubject.course,
          semester: 3
        }
      ];

      const mockTimetableQuery = {
        populate: jest.fn().mockReturnThis(),
        then: function (resolve) {
          resolve(mockSlots);
        }
      };
      // Allow chaining 3 populates
      mockTimetableQuery.populate.mockReturnValue(mockTimetableQuery);
      jest.spyOn(Timetable, 'find').mockReturnValue(mockTimetableQuery);

      jest.spyOn(SyllabusProgress, 'find').mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });
      jest.spyOn(Assignment, 'find').mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      jest.spyOn(Student, 'countDocuments').mockResolvedValue(42);
      jest.spyOn(SyllabusProgress, 'findOne').mockResolvedValue({
        subject: mockSubject._id,
        faculty: mockFacultyDoc._id,
        units: [
          { unitNumber: 1, title: 'Unit 1', status: 'completed' },
          { unitNumber: 2, title: 'Unit 2', status: 'in_progress' },
          { unitNumber: 3, title: 'Unit 3', status: 'not_started' }
        ]
      });
      jest.spyOn(Assignment, 'countDocuments').mockResolvedValue(2);

      const res = await request(app)
        .get('/api/v1/faculty/me/assigned-subjects')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);

      const sub = res.body.data[0];
      expect(sub.code).toBe('CS301');
      expect(sub.name).toBe('Data Structures & Algorithms');
      expect(sub.credits).toBe(4);
      expect(sub.enrolledCount).toBe(42);
      expect(sub.rooms).toEqual(expect.arrayContaining(['LH-101', 'CS-Lab-1']));
      expect(sub.weeklyLecturesCount).toBe(2);
      expect(sub.syllabusCompletion).toBe(33); // 1 out of 3 = 33%
    });

    it('GET /api/v1/faculty/me/assigned-subjects/:subjectId/students enforces faculty subject assignment ownership', async () => {
      jest.spyOn(Faculty, 'findOne').mockResolvedValue(mockFacultyDoc);
      // Faculty is NOT assigned to this foreign subject
      jest.spyOn(Timetable, 'findOne').mockResolvedValue(null);
      jest.spyOn(SyllabusProgress, 'findOne').mockResolvedValue(null);
      jest.spyOn(Assignment, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/faculty/me/assigned-subjects/507f1f77bcf86cd799439099/students')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(403);
      const code = res.body.error?.code || res.body.code;
      expect(code).toBe('NOT_ASSIGNED_TO_SUBJECT');
    });

    it('GET /api/v1/faculty/me/assigned-subjects/:subjectId/students returns 200 with roster when authorized', async () => {
      jest.spyOn(Faculty, 'findOne').mockResolvedValue(mockFacultyDoc);
      jest.spyOn(Timetable, 'findOne').mockResolvedValue({ _id: '507f1f77bcf86cd799439071' });
      jest.spyOn(SyllabusProgress, 'findOne').mockResolvedValue(null);
      jest.spyOn(Assignment, 'findOne').mockResolvedValue(null);

      jest.spyOn(Subject, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockSubject)
        })
      });

      const mockStudentQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([
          {
            _id: '507f1f77bcf86cd799439031',
            rollNumber: '24CSE001',
            currentSemester: 3,
            admissionStatus: 'enrolled',
            user: { name: 'Aarav Sharma', email: 'aarav@college.edu', status: 'active' },
            department: mockSubject.department
          }
        ])
      };
      mockStudentQuery.populate.mockReturnValue(mockStudentQuery);
      jest.spyOn(Student, 'find').mockReturnValue(mockStudentQuery);

      jest.spyOn(Attendance, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { student: '507f1f77bcf86cd799439031', subject: mockSubject._id, status: 'present' }
        ])
      });

      jest.spyOn(Result, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { student: '507f1f77bcf86cd799439031', subject: mockSubject._id, totalMarks: 85, grade: 'A' }
        ])
      });

      const res = await request(app)
        .get(`/api/v1/faculty/me/assigned-subjects/${mockSubject._id}/students`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.students.length).toBe(1);

      const st = res.body.data.students[0];
      expect(st.rollNumber).toBe('24CSE001');
      expect(st.attendance.percentage).toBe(100);
      expect(st.performance.grade).toBe('A');
    });
  });
});
