const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const Faculty = require('../src/modules/faculty/faculty.model');
const Timetable = require('../src/modules/timetable/timetable.model');
const Student = require('../src/modules/students/student.model');
const Result = require('../src/modules/results/result.model');
const { Assignment, Submission } = require('../src/modules/assignments/assignment.model');
const Attendance = require('../src/modules/attendance/attendance.model');

describe('Faculty Student Performance Analytics Test Suite (Phase 2)', () => {
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

  const facultyDoc = {
    _id: '507f1f77bcf86cd799439010',
    user: facultyUser._id,
    employeeId: 'FAC-001',
    designation: 'Assistant Professor'
  };

  const assignedSubject = {
    _id: '507f1f77bcf86cd799439020',
    name: 'Data Structures & Algorithms',
    code: 'CS301',
    semester: 3,
    credits: 4
  };

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const idStr = id ? id.toString() : '';
      if (idStr === facultyUser._id) return { select: jest.fn().mockResolvedValue(facultyUser) };
      if (idStr === studentUser._id) return { select: jest.fn().mockResolvedValue(studentUser) };
      return { select: jest.fn().mockResolvedValue(null) };
    });

    jest.spyOn(Faculty, 'findOne').mockResolvedValue(facultyDoc);

    const mockTimetableQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: '607f1f77bcf86cd799439030',
          faculty: facultyDoc._id,
          subject: assignedSubject,
          semester: 3,
          section: 'A'
        }
      ])
    };
    jest.spyOn(Timetable, 'find').mockReturnValue(mockTimetableQuery);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/v1/faculty/me/analytics/overview returns 200 with 6 KPI cards for faculty', async () => {
    const mockStudents = [
      {
        _id: '607f1f77bcf86cd799439040',
        rollNumber: 'CS2023001',
        user: { name: 'Aarav Sharma', email: 'aarav@college.edu' }
      }
    ];

    const mockResults = [
      {
        _id: '707f1f77bcf86cd799439050',
        subject: assignedSubject._id,
        student: mockStudents[0]._id,
        totalMarks: 85,
        grade: 'A+'
      }
    ];

    const studentFindQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockStudents)
    };
    jest.spyOn(Student, 'find').mockReturnValue(studentFindQuery);

    const resultFindQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockResults)
    };
    jest.spyOn(Result, 'find').mockReturnValue(resultFindQuery);

    const assignFindQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Assignment, 'find').mockReturnValue(assignFindQuery);

    const subFindQuery = {
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Submission, 'find').mockReturnValue(subFindQuery);

    const attFindQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Attendance, 'find').mockReturnValue(attFindQuery);

    const res = await request(app)
      .get('/api/v1/faculty/me/analytics/overview')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalStudents).toBe(1);
    expect(res.body.data.classAverage).toBe(85);
    expect(res.body.data.highestPerformance).toBe(85);
    expect(res.body.data.lowestPerformance).toBe(85);
    expect(res.body.data.passPercentage).toBe(100);
  });

  it('GET /api/v1/faculty/me/analytics/subjects returns subject-wise performance breakdown', async () => {
    const studentFindQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: '607f1f77bcf86cd799439040' }])
    };
    jest.spyOn(Student, 'find').mockReturnValue(studentFindQuery);

    const resultFindQuery = {
      lean: jest.fn().mockResolvedValue([{ totalMarks: 78 }])
    };
    jest.spyOn(Result, 'find').mockReturnValue(resultFindQuery);

    const assignFindQuery = {
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Assignment, 'find').mockReturnValue(assignFindQuery);

    const subFindQuery = {
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Submission, 'find').mockReturnValue(subFindQuery);

    const res = await request(app)
      .get('/api/v1/faculty/me/analytics/subjects')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].code).toBe('CS301');
    expect(res.body.data[0].averageMarks).toBe(78);
  });

  it('GET /api/v1/faculty/me/analytics/students returns paginated student list with risk analysis', async () => {
    const mockStudents = [
      {
        _id: '607f1f77bcf86cd799439040',
        rollNumber: 'CS2023001',
        currentSemester: 3,
        section: 'A',
        user: { name: 'Aarav Sharma', email: 'aarav@college.edu' },
        department: { name: 'CSE', code: 'CSE' }
      }
    ];

    const studentFindQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockStudents)
    };
    jest.spyOn(Student, 'find').mockReturnValue(studentFindQuery);

    const resultFindQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { student: mockStudents[0]._id, totalMarks: 35 } // < 50% triggers at-risk flag
      ])
    };
    jest.spyOn(Result, 'find').mockReturnValue(resultFindQuery);

    const assignFindQuery = {
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Assignment, 'find').mockReturnValue(assignFindQuery);

    const subFindQuery = {
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Submission, 'find').mockReturnValue(subFindQuery);

    const attFindQuery = {
      lean: jest.fn().mockResolvedValue([])
    };
    jest.spyOn(Attendance, 'find').mockReturnValue(attFindQuery);

    const res = await request(app)
      .get('/api/v1/faculty/me/analytics/students')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].rollNumber).toBe('CS2023001');
    expect(res.body.data[0].isAtRisk).toBe(true);
    expect(res.body.data[0].riskFlags.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/faculty/me/analytics/overview rejects unauthorized student role with 403', async () => {
    const res = await request(app)
      .get('/api/v1/faculty/me/analytics/overview')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });
});
