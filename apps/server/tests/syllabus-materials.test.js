const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const SyllabusProgress = require('../src/modules/syllabus/syllabus.model');
const LearningMaterial = require('../src/modules/materials/material.model');

describe('Syllabus Progress & Learning Materials Test Suite (Phase 4.3 & 4.4)', () => {
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

  describe('1. Syllabus Progress Management (Phase 4.3)', () => {
    const mockSubjectId = '507f1f77bcf86cd799439020';

    it('GET /api/v1/syllabus/faculty/summary returns 200 with syllabus summaries', async () => {
      const mockRecords = [
        {
          _id: '607f1f77bcf86cd799439050',
          subject: { name: 'Data Structures & Algorithms', code: 'CS301' },
          faculty: facultyUser._id,
          units: [
            { unitNumber: 1, title: 'Unit I', status: 'completed' },
            { unitNumber: 2, title: 'Unit II', status: 'in_progress' },
            { unitNumber: 3, title: 'Unit III', status: 'not_started' }
          ]
        }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRecords)
      };

      jest.spyOn(SyllabusProgress, 'find').mockReturnValue(mockQuery);

      const res = await request(app)
        .get('/api/v1/syllabus/faculty/summary')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].summary.completedUnits).toBe(1);
      expect(res.body.data[0].summary.inProgressUnits).toBe(1);
      expect(res.body.data[0].summary.completionPercentage).toBe(33);
    });

    it('GET /api/v1/syllabus/subject/:subjectId returns unit-by-unit syllabus data', async () => {
      const mockDoc = {
        _id: '607f1f77bcf86cd799439050',
        subject: { _id: mockSubjectId, name: 'Data Structures', code: 'CS301' },
        faculty: facultyUser._id,
        units: [
          { unitNumber: 1, title: 'Unit I', status: 'completed' },
          { unitNumber: 2, title: 'Unit II', status: 'not_started' }
        ],
        toObject() {
          return { ...this };
        }
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis()
      };
      // Chain populate twice then resolve
      mockQuery.populate.mockReturnValueOnce(mockQuery).mockResolvedValueOnce(mockDoc);

      jest.spyOn(SyllabusProgress, 'findOne').mockReturnValue(mockQuery);

      const res = await request(app)
        .get(`/api/v1/syllabus/subject/${mockSubjectId}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.completedUnits).toBe(1);
      expect(res.body.data.summary.completionPercentage).toBe(50);
    });

    it('PATCH /api/v1/syllabus/subject/:subjectId/unit/:unitNumber updates unit status', async () => {
      const mockDoc = {
        _id: '607f1f77bcf86cd799439050',
        subject: mockSubjectId,
        faculty: facultyUser._id,
        units: [
          { unitNumber: 1, title: 'Unit I', status: 'not_started', completedAt: null },
          { unitNumber: 2, title: 'Unit II', status: 'not_started', completedAt: null }
        ],
        save: jest.fn().mockResolvedValue(true),
        toObject() {
          return { ...this };
        }
      };

      jest.spyOn(SyllabusProgress, 'findOne').mockResolvedValue(mockDoc);

      const res = await request(app)
        .patch(`/api/v1/syllabus/subject/${mockSubjectId}/unit/1`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ status: 'completed', completionRemarks: 'Covered all trees and heaps' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.units[0].status).toBe('completed');
      expect(mockDoc.units[0].completedAt).toBeInstanceOf(Date);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('PATCH /api/v1/syllabus/subject/:subjectId/unit/:unitNumber rejects invalid status', async () => {
      const res = await request(app)
        .patch(`/api/v1/syllabus/subject/${mockSubjectId}/unit/1`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Learning Material Management (Phase 4.4)', () => {
    it('GET /api/v1/materials returns list of learning materials', async () => {
      const mockMaterials = [
        {
          _id: '607f1f77bcf86cd799439060',
          title: 'Lecture 1: Trees and Graphs PDF',
          subject: { name: 'Data Structures', code: 'CS301' },
          unitNumber: 1,
          fileName: 'lecture_trees.pdf',
          fileUrl: 'https://example.com/lecture_trees.pdf',
          fileSize: 2048000
        }
      ];

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockMaterials)
      };

      jest.spyOn(LearningMaterial, 'find').mockReturnValue(mockQuery);

      const res = await request(app)
        .get('/api/v1/materials')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Lecture 1: Trees and Graphs PDF');
    });

    it('POST /api/v1/materials creates new material record', async () => {
      const payload = {
        title: 'Midterm Revision Notes',
        subject: '507f1f77bcf86cd799439020',
        unitNumber: 2,
        fileName: 'midterm_notes.pdf',
        fileUrl: 'https://storage.college.edu/notes/midterm_notes.pdf',
        fileSize: 1048576
      };

      const createdDoc = {
        _id: '607f1f77bcf86cd799439061',
        ...payload,
        faculty: facultyUser._id
      };

      jest.spyOn(LearningMaterial, 'create').mockResolvedValue(createdDoc);

      const res = await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(payload.title);
      expect(LearningMaterial.create).toHaveBeenCalled();
    });

    it('POST /api/v1/materials rejects oversized files (> 25MB)', async () => {
      const payload = {
        title: 'Huge Video Lecture',
        subject: '507f1f77bcf86cd799439020',
        unitNumber: 1,
        fileName: 'huge_video.mp4',
        fileUrl: 'https://example.com/huge.mp4',
        fileSize: 30000000 // 30MB
      };

      const res = await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code || res.body.code).toBe('FILE_TOO_LARGE');
    });

    it('DELETE /api/v1/materials/:id deletes authorized material', async () => {
      const mockDoc = {
        _id: '607f1f77bcf86cd799439061',
        title: 'Notes to remove',
        faculty: facultyUser._id
      };

      jest.spyOn(LearningMaterial, 'findById').mockResolvedValue(mockDoc);
      jest.spyOn(LearningMaterial, 'findByIdAndDelete').mockResolvedValue(mockDoc);

      const res = await request(app)
        .delete('/api/v1/materials/607f1f77bcf86cd799439061')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(LearningMaterial.findByIdAndDelete).toHaveBeenCalledWith('607f1f77bcf86cd799439061');
    });
  });
});
