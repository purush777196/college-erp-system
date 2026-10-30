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
});
