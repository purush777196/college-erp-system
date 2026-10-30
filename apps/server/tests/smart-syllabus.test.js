const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { ROLES } = require('@college-erp/shared');

const User = require('../src/modules/auth/auth.model');
const Faculty = require('../src/modules/faculty/faculty.model');
const Subject = require('../src/modules/subjects/subject.model');
const SyllabusProgress = require('../src/modules/syllabus/syllabus.model');
const Timetable = require('../src/modules/timetable/timetable.model');

describe('Smart Syllabus Tracker Test Suite (Phase 3)', () => {
  const facultyUser = {
    _id: '507f1f77bcf86cd799439002',
    name: 'Dr. Alan Turing',
    email: 'faculty.turing@college.edu',
    role: ROLES.FACULTY,
    status: 'active'
  };

  const accountsUser = {
    _id: '507f1f77bcf86cd799439004',
    name: 'Accountant Verma',
    email: 'accounts@college.edu',
    role: ROLES.ACCOUNTS,
    status: 'active'
  };

  const facultyToken = jwt.sign(
    { id: facultyUser._id, role: facultyUser.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const accountsToken = jwt.sign(
    { id: accountsUser._id, role: accountsUser.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const mockSubjectId = '507f1f77bcf86cd799439020';
  const mockUnitId = '507f1f77bcf86cd799439031';
  const mockTopicId = '507f1f77bcf86cd799439041';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(User, 'findById').mockImplementation((id) => ({
      select: jest.fn().mockResolvedValue(String(id) === String(facultyUser._id) ? facultyUser : accountsUser)
    }));
    jest.spyOn(Faculty, 'findOne').mockResolvedValue({
      _id: '507f1f77bcf86cd799439010',
      user: facultyUser._id,
      employeeId: 'FAC-001'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Access Control & Authorization', () => {
    it('rejects unauthorized accounts role with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/syllabus/subject/${mockSubjectId}/progress`)
        .set('Authorization', `Bearer ${accountsToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/api/v1/syllabus/subject/${mockSubjectId}/progress`);

      expect(res.status).toBe(401);
    });
  });

  describe('2. Unit Management (CRUD)', () => {
    it('creates a new unit in syllabus via POST /api/v1/syllabus/subject/:subjectId/units', async () => {
      const mockDoc = {
        _id: '607f1f77bcf86cd799439050',
        subject: mockSubjectId,
        faculty: '507f1f77bcf86cd799439010',
        units: [
          { _id: mockUnitId, unitNumber: 1, title: 'Unit I', topics: [] }
        ],
        save: jest.fn().mockResolvedValue(true),
        toObject() { return { ...this }; }
      };

      jest.spyOn(SyllabusProgress, 'findOne').mockResolvedValue(mockDoc);

      const res = await request(app)
        .post(`/api/v1/syllabus/subject/${mockSubjectId}/units`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: 'Unit II: Advanced System Design',
          description: 'Microservices and distributed patterns',
          plannedHours: 12
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockDoc.units.length).toBe(2);
      expect(mockDoc.units[1].unitNumber).toBe(2);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('rejects unit creation when title is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/syllabus/subject/${mockSubjectId}/units`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ title: '   ', plannedHours: 10 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Topic Management & Smart Progress Tracking', () => {
    it('adds a topic to a unit and tracks estimated hours', async () => {
      const mockUnit = {
        _id: mockUnitId,
        unitNumber: 1,
        title: 'Unit I',
        topics: []
      };

      const mockUnits = [mockUnit];
      mockUnits.id = (id) => (String(id) === String(mockUnitId) ? mockUnit : null);

      const mockDoc = {
        _id: '607f1f77bcf86cd799439050',
        subject: mockSubjectId,
        faculty: '507f1f77bcf86cd799439010',
        units: mockUnits,
        save: jest.fn().mockResolvedValue(true),
        toObject() { return { ...this }; }
      };

      jest.spyOn(SyllabusProgress, 'findOne').mockResolvedValue(mockDoc);

      const res = await request(app)
        .post(`/api/v1/syllabus/subject/${mockSubjectId}/units/${mockUnitId}/topics`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          title: 'Asymptotic Analysis & Big-O Notation',
          estimatedHours: 3,
          plannedCompletionDate: '2026-11-15'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockUnit.topics.length).toBe(1);
      expect(mockUnit.topics[0].title).toBe('Asymptotic Analysis & Big-O Notation');
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('updates topic status to completed and sets actualCompletionDate', async () => {
      const mockTopic = {
        _id: mockTopicId,
        title: 'Asymptotic Analysis',
        status: 'in_progress',
        actualCompletionDate: null
      };

      const mockTopics = [mockTopic];
      mockTopics.id = (id) => (String(id) === String(mockTopicId) ? mockTopic : null);

      const mockUnit = {
        _id: mockUnitId,
        unitNumber: 1,
        title: 'Unit I',
        status: 'in_progress',
        topics: mockTopics
      };

      const mockUnits = [mockUnit];
      mockUnits.id = (id) => (String(id) === String(mockUnitId) ? mockUnit : null);

      const mockDoc = {
        _id: '607f1f77bcf86cd799439050',
        subject: mockSubjectId,
        faculty: '507f1f77bcf86cd799439010',
        units: mockUnits,
        save: jest.fn().mockResolvedValue(true),
        toObject() { return { ...this }; }
      };

      jest.spyOn(SyllabusProgress, 'findOne').mockResolvedValue(mockDoc);

      const res = await request(app)
        .put(`/api/v1/syllabus/subject/${mockSubjectId}/units/${mockUnitId}/topics/${mockTopicId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          status: 'completed',
          teachingNotes: 'Completed proof techniques and empirical measurements'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockTopic.status).toBe('completed');
      expect(mockTopic.actualCompletionDate).toBeInstanceOf(Date);
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe('4. Delayed Topic Detection & Analytics', () => {
    it('detects overdue incomplete topics and computes planned vs actual metrics', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago

      const mockDoc = {
        _id: '607f1f77bcf86cd799439050',
        subject: { _id: mockSubjectId, name: 'Cloud Computing', code: 'CS402' },
        faculty: { employeeId: 'FAC-001' },
        units: [
          {
            _id: mockUnitId,
            unitNumber: 1,
            title: 'Unit I: Cloud Models',
            status: 'in_progress',
            topics: [
              {
                _id: mockTopicId,
                title: 'Virtualization & Hypervisors',
                status: 'in_progress', // incomplete
                estimatedHours: 3,
                plannedCompletionDate: pastDate // overdue!
              },
              {
                _id: '507f1f77bcf86cd799439042',
                title: 'Containerization & Docker',
                status: 'completed',
                estimatedHours: 2,
                plannedCompletionDate: pastDate
              }
            ]
          }
        ],
        toObject() { return { ...this }; }
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis()
      };
      mockQuery.populate.mockReturnValueOnce(mockQuery).mockResolvedValueOnce(mockDoc);
      jest.spyOn(SyllabusProgress, 'findOne').mockReturnValue(mockQuery);
      jest.spyOn(Timetable, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          { dayOfWeek: 'Monday', periodNumber: 2, startTime: '10:00', endTime: '10:50', roomNumber: 'LH-101', section: 'A' }
        ])
      });

      const res = await request(app)
        .get(`/api/v1/syllabus/subject/${mockSubjectId}/progress`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalTopics).toBe(2);
      expect(res.body.data.summary.completedTopics).toBe(1);
      expect(res.body.data.summary.completionPercentage).toBe(50);
      expect(res.body.data.summary.delayedTopicsCount).toBe(1);
      expect(res.body.data.summary.delayedTopics[0].topicTitle).toBe('Virtualization & Hypervisors');
      expect(res.body.data.summary.delayedTopics[0].daysOverdue).toBeGreaterThanOrEqual(6);
      expect(res.body.data.scheduleContext.weeklySessionsCount).toBe(1);
    });
  });
});
