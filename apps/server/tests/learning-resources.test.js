const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const Faculty = require('../src/modules/faculty/faculty.model');
const LearningMaterial = require('../src/modules/materials/material.model');

describe('Learning Resource Library Test Suite (Phase 4)', () => {
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

  const mockSubjectId = '507f1f77bcf86cd799439020';
  const mockMaterialId = '507f1f77bcf86cd799439070';
  const facultyDocId = '507f1f77bcf86cd799439010';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(User, 'findById').mockImplementation((id) => ({
      select: jest.fn().mockResolvedValue(
        String(id) === String(studentUser._id) ? studentUser :
        String(id) === String(otherFacultyUser._id) ? otherFacultyUser : facultyUser
      )
    }));

    jest.spyOn(Faculty, 'findOne').mockImplementation(({ user }) => {
      if (String(user) === String(otherFacultyUser._id)) {
        return Promise.resolve({ _id: '507f1f77bcf86cd799439099', user: otherFacultyUser._id, employeeId: 'FAC-999' });
      }
      return Promise.resolve({ _id: facultyDocId, user: facultyUser._id, employeeId: 'FAC-001' });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Resource Creation & External Links', () => {
    it('creates an external educational link resource with valid HTTPS URL', async () => {
      const createdDoc = {
        _id: mockMaterialId,
        title: 'MIT Lecture: Distributed Systems',
        resourceType: 'link',
        externalUrl: 'https://youtube.com/watch?v=example',
        category: 'Videos',
        subject: mockSubjectId,
        faculty: facultyDocId,
        visibility: 'student_accessible',
        publicationStatus: 'published',
        toObject() { return { ...this }; }
      };

      jest.spyOn(LearningMaterial, 'create').mockResolvedValue(createdDoc);

      const res = await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: 'MIT Lecture: Distributed Systems',
          resourceType: 'link',
          externalUrl: 'https://youtube.com/watch?v=example',
          category: 'Videos',
          subject: mockSubjectId,
          unitNumber: 2,
          topicTitle: 'Raft Consensus Algorithm'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resourceType).toBe('link');
      expect(LearningMaterial.create).toHaveBeenCalled();
    });

    it('rejects external link with invalid protocol (javascript: or ftp:)', async () => {
      const res = await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: 'Malicious Link',
          resourceType: 'link',
          externalUrl: 'javascript:alert(1)',
          subject: mockSubjectId
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('creates a file resource with syllabus unit and topic links', async () => {
      const createdDoc = {
        _id: mockMaterialId,
        title: 'Chapter 3: Dynamic Programming Notes',
        resourceType: 'file',
        fileName: 'dp_notes.pdf',
        fileUrl: 'https://storage.college.edu/dp_notes.pdf',
        fileSize: 4194304,
        category: 'Lecture Notes',
        tags: ['algorithms', 'dp', 'exam_prep'],
        subject: mockSubjectId,
        faculty: facultyDocId,
        unitNumber: 3,
        unitTitle: 'Unit III: Analytical Algorithms',
        topicTitle: 'Bellman-Ford Algorithm',
        visibility: 'student_accessible',
        publicationStatus: 'published',
        toObject() { return { ...this }; }
      };

      jest.spyOn(LearningMaterial, 'create').mockResolvedValue(createdDoc);

      const res = await request(app)
        .post('/api/v1/materials')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: 'Chapter 3: Dynamic Programming Notes',
          resourceType: 'file',
          fileName: 'dp_notes.pdf',
          fileUrl: 'https://storage.college.edu/dp_notes.pdf',
          fileSize: 4194304,
          category: 'Lecture Notes',
          tags: ['algorithms', 'dp', 'exam_prep'],
          subject: mockSubjectId,
          unitNumber: 3,
          unitTitle: 'Unit III: Analytical Algorithms',
          topicTitle: 'Bellman-Ford Algorithm'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tags).toContain('algorithms');
    });
  });

  describe('2. Visibility & Student Access Control', () => {
    it('denies student access to faculty-only resources with 403 Forbidden', async () => {
      const mockDoc = {
        _id: mockMaterialId,
        title: 'Midterm Solution Key (Faculty Only)',
        visibility: 'faculty_only',
        publicationStatus: 'published',
        subject: { name: 'Algorithms' },
        faculty: { employeeId: 'FAC-001' },
        save: jest.fn().mockResolvedValue(true)
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis()
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery).mockResolvedValueOnce(mockDoc);
      jest.spyOn(LearningMaterial, 'findById').mockReturnValue(mockQuery);

      const res = await request(app)
        .get(`/api/v1/materials/${mockMaterialId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('denies student access to draft resources with 403 Forbidden', async () => {
      const mockDoc = {
        _id: mockMaterialId,
        title: 'Unpublished Question Bank',
        visibility: 'student_accessible',
        publicationStatus: 'draft',
        subject: { name: 'Algorithms' },
        faculty: { employeeId: 'FAC-001' },
        save: jest.fn().mockResolvedValue(true)
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis()
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery).mockResolvedValueOnce(mockDoc);
      jest.spyOn(LearningMaterial, 'findById').mockReturnValue(mockQuery);

      const res = await request(app)
        .get(`/api/v1/materials/${mockMaterialId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Resource Management & Cross-Faculty Protection', () => {
    it('prevents a faculty member from updating another faculty member resource', async () => {
      const mockDoc = {
        _id: mockMaterialId,
        title: 'Dr. Turing Lecture Notes',
        faculty: facultyDocId // owned by Dr. Turing
      };

      jest.spyOn(LearningMaterial, 'findById').mockResolvedValue(mockDoc);

      const res = await request(app)
        .put(`/api/v1/materials/${mockMaterialId}`)
        .set('Authorization', `Bearer ${otherFacultyToken}`) // Other faculty attempting update
        .send({ title: 'Tampered Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('publishes and archives a resource via PATCH endpoints', async () => {
      const mockDoc = {
        _id: mockMaterialId,
        title: 'Unit II Presentation',
        faculty: facultyDocId,
        publicationStatus: 'draft',
        isPublished: false,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(LearningMaterial, 'findById').mockResolvedValue(mockDoc);

      const res = await request(app)
        .patch(`/api/v1/materials/${mockMaterialId}/publish`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockDoc.publicationStatus).toBe('published');
      expect(mockDoc.isPublished).toBe(true);
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe('4. Resource Download & Access Analytics', () => {
    it('increments download count on authenticated download', async () => {
      const mockDoc = {
        _id: mockMaterialId,
        title: 'Lab Manual',
        resourceType: 'file',
        fileName: 'lab_manual.pdf',
        fileUrl: 'https://storage.college.edu/lab_manual.pdf',
        fileType: 'application/pdf',
        downloadCount: 5,
        visibility: 'student_accessible',
        publicationStatus: 'published',
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(LearningMaterial, 'findById').mockResolvedValue(mockDoc);

      const res = await request(app)
        .get(`/api/v1/materials/${mockMaterialId}/download`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(302); // Redirect to external storage or 200
      expect(mockDoc.downloadCount).toBe(6);
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });
});
