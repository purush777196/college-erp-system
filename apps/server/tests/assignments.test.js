const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const { Assignment, Submission } = require('../src/modules/assignments/assignment.model');

describe('Assignment & Submission Management Test Suite (Phase 4.1 & 4.2)', () => {
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

  describe('1. Assignment CRUD Operations', () => {
    it('GET /api/v1/assignments returns 200 with assignments list for faculty', async () => {
      const mockAssignments = [
        {
          _id: '607f1f77bcf86cd799439011',
          title: 'Binary Search Trees Implementation',
          subject: { name: 'Data Structures & Algorithms', code: 'CS301' },
          faculty: facultyUser._id,
          semester: 3,
          maxMarks: 20,
          status: 'published',
          dueDate: new Date(Date.now() + 86400000).toISOString()
        }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockAssignments)
      };

      jest.spyOn(Assignment, 'find').mockReturnValue(mockQuery);

      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Binary Search Trees Implementation');
    });

    it('POST /api/v1/assignments creates new assignment when input is valid', async () => {
      const newAssignment = {
        _id: '607f1f77bcf86cd799439012',
        title: 'Graph Traversal Algorithms',
        subject: '507f1f77bcf86cd799439020',
        faculty: facultyUser._id,
        semester: 3,
        maxMarks: 25,
        status: 'draft',
        dueDate: new Date(Date.now() + 172800000).toISOString()
      };

      jest.spyOn(Assignment, 'create').mockResolvedValue(newAssignment);

      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: 'Graph Traversal Algorithms',
          subject: '507f1f77bcf86cd799439020',
          semester: 3,
          maxMarks: 25,
          status: 'draft',
          dueDate: new Date(Date.now() + 172800000).toISOString(),
          instructions: 'Implement BFS and DFS in C++'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Graph Traversal Algorithms');
    });

    it('POST /api/v1/assignments rejects missing title or dueDate with 400', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          subject: '507f1f77bcf86cd799439020',
          semester: 3
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('PATCH /api/v1/assignments/:id/publish transitions draft to published', async () => {
      const mockAssignDoc = {
        _id: '607f1f77bcf86cd799439012',
        title: 'Draft Assignment',
        faculty: facultyUser._id,
        status: 'draft',
        publishDate: null,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockAssignDoc);

      const res = await request(app)
        .patch('/api/v1/assignments/607f1f77bcf86cd799439012/publish')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAssignDoc.status).toBe('published');
    });
  });

  describe('2. Student Submissions & Evaluation', () => {
    it('GET /api/v1/assignments/:id/submissions returns submissions and roster', async () => {
      const mockAssignDoc = {
        _id: '607f1f77bcf86cd799439011',
        title: 'BST Implementation',
        faculty: facultyUser._id,
        maxMarks: 20,
        dueDate: new Date(),
        status: 'published',
        semester: 3,
        populate: jest.fn().mockResolvedValue({
          _id: '607f1f77bcf86cd799439011',
          faculty: facultyUser._id,
          semester: 3
        })
      };

      jest.spyOn(Assignment, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAssignDoc)
      });

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: '707f1f77bcf86cd799439001',
            assignment: '607f1f77bcf86cd799439011',
            student: { _id: '507f1f77bcf86cd799439031', rollNumber: '24CSE001' },
            status: 'submitted',
            content: 'Repository link submitted',
            submittedAt: new Date().toISOString()
          }
        ])
      };

      jest.spyOn(Submission, 'find').mockReturnValue(mockQuery);

      const res = await request(app)
        .get('/api/v1/assignments/607f1f77bcf86cd799439011/submissions')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.submissions.length).toBe(1);
    });

    it('POST /api/v1/assignments/:id/submissions/:submissionId/evaluate grades submission', async () => {
      const mockAssignDoc = {
        _id: '607f1f77bcf86cd799439011',
        faculty: facultyUser._id,
        maxMarks: 20
      };

      const mockSubDoc = {
        _id: '707f1f77bcf86cd799439001',
        assignment: mockAssignDoc._id,
        student: '507f1f77bcf86cd799439031',
        marksObtained: null,
        feedback: '',
        status: 'submitted',
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockAssignDoc);
      jest.spyOn(Submission, 'findById').mockResolvedValue(mockSubDoc);

      const res = await request(app)
        .post('/api/v1/assignments/607f1f77bcf86cd799439011/submissions/707f1f77bcf86cd799439001/evaluate')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksObtained: 18,
          feedback: 'Excellent implementation and clean documentation'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockSubDoc.marksObtained).toBe(18);
      expect(mockSubDoc.status).toBe('evaluated');
    });

    it('POST /api/v1/assignments/:id/submissions/:submissionId/evaluate rejects marks above maxMarks with 400', async () => {
      const mockAssignDoc = {
        _id: '607f1f77bcf86cd799439011',
        faculty: facultyUser._id,
        maxMarks: 20
      };

      jest.spyOn(Assignment, 'findById').mockResolvedValue(mockAssignDoc);

      const res = await request(app)
        .post('/api/v1/assignments/607f1f77bcf86cd799439011/submissions/707f1f77bcf86cd799439001/evaluate')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksObtained: 25,
          feedback: 'Exceeds maximum marks'
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('INVALID_MARKS');
    });
  });
});
