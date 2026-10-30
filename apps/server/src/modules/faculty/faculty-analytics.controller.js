const mongoose = require('mongoose');
const Faculty = require('./faculty.model');
const Timetable = require('../timetable/timetable.model');
const Subject = require('../subjects/subject.model');
const Student = require('../students/student.model');
const Result = require('../results/result.model');
const Exam = require('../examinations/exam.model');
const { Assignment, Submission } = require('../assignments/assignment.model');
const Attendance = require('../attendance/attendance.model');
const { sendSuccess, sendError } = require('../../utils/response');
const { HTTP_STATUS, ROLES } = require('@college-erp/shared');

/**
 * Helper: Resolve authoritative faculty document & assigned subject IDs
 */
async function getFacultyAndAssignedSubjects(user) {
  if (!user) return { faculty: null, assignedSubjectIds: [], assignedSubjects: [] };

  const faculty = await Faculty.findOne({ user: user._id });
  if (!faculty) return { faculty: null, assignedSubjectIds: [], assignedSubjects: [] };

  // Fetch timetable allocations for this faculty
  const slots = await Timetable.find({ faculty: faculty._id })
    .populate('subject', 'name code credits semester department course')
    .populate('department', 'name code')
    .lean();

  const subjectMap = new Map();
  slots.forEach((slot) => {
    if (!slot.subject) return;
    const sId = String(slot.subject._id || slot.subject.id);
    if (!subjectMap.has(sId)) {
      subjectMap.set(sId, {
        _id: slot.subject._id,
        name: slot.subject.name,
        code: slot.subject.code,
        semester: slot.semester || slot.subject.semester,
        department: slot.department || slot.subject.department,
        sections: new Set(slot.section ? [slot.section] : ['A']),
        rooms: new Set(slot.roomNumber ? [slot.roomNumber] : [])
      });
    } else {
      const existing = subjectMap.get(sId);
      if (slot.section) existing.sections.add(slot.section);
      if (slot.roomNumber) existing.rooms.add(slot.roomNumber);
    }
  });

  const assignedSubjects = Array.from(subjectMap.values()).map((s) => ({
    ...s,
    sections: Array.from(s.sections),
    section: Array.from(s.sections).join(', ') || 'A',
    rooms: Array.from(s.rooms)
  }));

  const assignedSubjectIds = assignedSubjects.map((s) => s._id);

  return { faculty, assignedSubjectIds, assignedSubjects };
}

/**
 * GET /api/v1/faculty/me/analytics/overview
 * Returns 6 authoritative KPI metrics for authenticated faculty's assigned courses
 */
async function getAnalyticsOverview(req, res, next) {
  try {
    const { faculty, assignedSubjectIds, assignedSubjects } = await getFacultyAndAssignedSubjects(req.user);

    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    if (assignedSubjectIds.length === 0) {
      return sendSuccess(res, {
        message: 'No teaching allocations assigned to faculty profile',
        data: {
          totalStudents: 0,
          classAverage: 0,
          highestPerformance: 0,
          lowestPerformance: 0,
          passPercentage: 0,
          studentsRequiringAttention: 0,
          totalEvaluationsCount: 0,
          totalAssignmentsCount: 0,
          totalExamsCount: 0
        }
      });
    }

    // Optional subject filtering
    let filterSubjectIds = assignedSubjectIds;
    if (req.query.subject) {
      const requestedId = String(req.query.subject);
      const isAuthorized = assignedSubjectIds.some((id) => String(id) === requestedId);
      if (!isAuthorized) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Access denied: You are not assigned to this subject',
          code: 'FORBIDDEN'
        });
      }
      filterSubjectIds = [new mongoose.Types.ObjectId(requestedId)];
    }

    // 1. Unique Enrolled Students across assigned subjects
    const semesterList = [...new Set(assignedSubjects.map((s) => Number(s.semester)).filter(Boolean))];
    const deptIdList = [...new Set(assignedSubjects.map((s) => s.department?._id || s.department).filter(Boolean))];

    const studentQuery = {
      currentSemester: { $in: semesterList }
    };
    if (deptIdList.length > 0) {
      studentQuery.department = { $in: deptIdList };
    }
    const enrolledStudents = await Student.find(studentQuery).select('_id rollNumber user section currentSemester department').lean();
    const enrolledStudentIds = enrolledStudents.map((s) => s._id);

    // 2. Examination Results for assigned subjects
    const examResults = await Result.find({
      subject: { $in: filterSubjectIds },
      student: { $in: enrolledStudentIds }
    }).populate('examination', 'name examType').lean();

    // 3. Assignment Submissions for assigned subjects
    const assignments = await Assignment.find({
      subject: { $in: filterSubjectIds }
    }).select('_id maxMarks title dueDate subject').lean();
    const assignmentIds = assignments.map((a) => a._id);
    const assignmentMap = new Map(assignments.map((a) => [String(a._id), a]));

    const assignmentSubmissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: { $in: enrolledStudentIds },
      status: 'evaluated',
      marksObtained: { $ne: null }
    }).lean();

    // 4. Attendance Records for assigned subjects
    const attendanceRecords = await Attendance.find({
      subject: { $in: filterSubjectIds },
      student: { $in: enrolledStudentIds }
    }).select('student status date').lean();

    // Normalizing scores to percentages for accurate comparison
    const normalizedScores = [];
    let passCount = 0;
    const PASSING_THRESHOLD = 40; // 40% standard passing benchmark

    // Exam scores (totalMarks / 100 * 100)
    examResults.forEach((r) => {
      if (r.totalMarks !== null && !isNaN(r.totalMarks)) {
        const pct = Math.max(0, Math.min(100, Number(r.totalMarks)));
        normalizedScores.push(pct);
        if (pct >= PASSING_THRESHOLD) passCount++;
      }
    });

    // Assignment scores (marksObtained / maxMarks * 100)
    assignmentSubmissions.forEach((sub) => {
      const assignDoc = assignmentMap.get(String(sub.assignment));
      const max = assignDoc?.maxMarks || 20;
      if (max > 0 && sub.marksObtained !== null && !isNaN(sub.marksObtained)) {
        const pct = Math.max(0, Math.min(100, (Number(sub.marksObtained) / max) * 100));
        normalizedScores.push(pct);
        if (pct >= PASSING_THRESHOLD) passCount++;
      }
    });

    const totalEvals = normalizedScores.length;
    const classAvg = totalEvals > 0 ? Math.round((normalizedScores.reduce((a, b) => a + b, 0) / totalEvals) * 10) / 10 : 0;
    const highest = totalEvals > 0 ? Math.round(Math.max(...normalizedScores) * 10) / 10 : 0;
    const lowest = totalEvals > 0 ? Math.round(Math.min(...normalizedScores) * 10) / 10 : 0;
    const passPct = totalEvals > 0 ? Math.round((passCount / totalEvals) * 100) : 0;

    // 5. At-Risk Student Identification
    // Criteria: Exam score < 50%, Assignment score < 50%, or Attendance compliance < 75%
    const studentRiskSet = new Set();

    // Check exam results below 50%
    examResults.forEach((r) => {
      if (r.totalMarks !== null && r.totalMarks < 50) {
        studentRiskSet.add(String(r.student));
      }
    });

    // Check assignment evaluations below 50%
    assignmentSubmissions.forEach((sub) => {
      const assignDoc = assignmentMap.get(String(sub.assignment));
      const max = assignDoc?.maxMarks || 20;
      if (max > 0 && (Number(sub.marksObtained) / max) * 100 < 50) {
        studentRiskSet.add(String(sub.student));
      }
    });

    // Check student attendance compliance < 75%
    const attendanceByStudent = new Map();
    attendanceRecords.forEach((att) => {
      const sId = String(att.student);
      if (!attendanceByStudent.has(sId)) {
        attendanceByStudent.set(sId, { total: 0, present: 0, late: 0 });
      }
      const data = attendanceByStudent.get(sId);
      data.total += 1;
      if (att.status === 'present') data.present += 1;
      if (att.status === 'late') data.late += 1;
    });

    attendanceByStudent.forEach((data, sId) => {
      if (data.total > 0) {
        const rate = ((data.present + data.late * 0.5) / data.total) * 100;
        if (rate < 75) {
          studentRiskSet.add(sId);
        }
      }
    });

    return sendSuccess(res, {
      message: 'Faculty performance analytics overview retrieved',
      data: {
        totalStudents: enrolledStudents.length,
        classAverage: classAvg,
        highestPerformance: highest,
        lowestPerformance: lowest,
        passPercentage: passPct,
        studentsRequiringAttention: studentRiskSet.size,
        totalEvaluationsCount: totalEvals,
        totalAssignmentsCount: assignments.length,
        totalExamsCount: [...new Set(examResults.map((r) => String(r.examination?._id || r.examination)))].length,
        passingThreshold: PASSING_THRESHOLD
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/faculty/me/analytics/subjects
 * Returns subject-wise performance breakdown for authorized assigned subjects
 */
async function getSubjectAnalytics(req, res, next) {
  try {
    const { faculty, assignedSubjectIds, assignedSubjects } = await getFacultyAndAssignedSubjects(req.user);

    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const subjectAnalytics = await Promise.all(
      assignedSubjects.map(async (sub) => {
        const subId = sub._id;
        const semester = Number(sub.semester);
        const deptId = sub.department?._id || sub.department;

        // 1. Enrolled students for this subject
        const query = { currentSemester: semester };
        if (deptId) query.department = deptId;
        const students = await Student.find(query).select('_id').lean();
        const studentIds = students.map((s) => s._id);

        // 2. Exam results for this subject
        const results = await Result.find({
          subject: subId,
          student: { $in: studentIds }
        }).lean();

        // 3. Assignments for this subject
        const assignments = await Assignment.find({ subject: subId }).lean();
        const assignIds = assignments.map((a) => a._id);
        const submissions = await Submission.find({
          assignment: { $in: assignIds },
          student: { $in: studentIds }
        }).lean();

        // Gather scores
        const scores = [];
        let passCount = 0;
        results.forEach((r) => {
          if (r.totalMarks !== null && !isNaN(r.totalMarks)) {
            scores.push(Number(r.totalMarks));
            if (Number(r.totalMarks) >= 40) passCount++;
          }
        });

        const evaluatedSubmissions = submissions.filter((s) => s.status === 'evaluated' && s.marksObtained !== null);
        evaluatedSubmissions.forEach((subm) => {
          const assignDoc = assignments.find((a) => String(a._id) === String(subm.assignment));
          const max = assignDoc?.maxMarks || 20;
          if (max > 0) {
            const pct = (Number(subm.marksObtained) / max) * 100;
            scores.push(pct);
            if (pct >= 40) passCount++;
          }
        });

        const pendingSubmissionsCount = submissions.filter((s) => s.status === 'submitted' && s.marksObtained === null).length;
        const totalEvaluated = scores.length;
        const avg = totalEvaluated > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / totalEvaluated) * 10) / 10 : 0;
        const high = totalEvaluated > 0 ? Math.round(Math.max(...scores) * 10) / 10 : 0;
        const low = totalEvaluated > 0 ? Math.round(Math.min(...scores) * 10) / 10 : 0;
        const passRate = totalEvaluated > 0 ? Math.round((passCount / totalEvaluated) * 100) : 0;

        return {
          subjectId: subId,
          name: sub.name,
          code: sub.code,
          semester: sub.semester,
          sections: sub.sections || ['A'],
          enrolledCount: students.length,
          evaluatedCount: totalEvaluated,
          averageMarks: avg,
          highestMarks: high,
          lowestMarks: low,
          passPercentage: passRate,
          pendingEvaluations: pendingSubmissionsCount,
          assignmentsCount: assignments.length
        };
      })
    );

    return sendSuccess(res, {
      message: 'Subject performance analytics retrieved',
      data: subjectAnalytics
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/faculty/me/analytics/students
 * Detailed student performance list with search, filter by subject/section/risk, sorting, and pagination
 */
async function getStudentPerformanceList(req, res, next) {
  try {
    const { faculty, assignedSubjectIds, assignedSubjects } = await getFacultyAndAssignedSubjects(req.user);

    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    if (assignedSubjectIds.length === 0) {
      return sendSuccess(res, {
        message: 'No students under assigned subjects',
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
      });
    }

    // Scoped subject filter
    let activeSubjectIds = assignedSubjectIds;
    if (req.query.subject) {
      const targetSub = String(req.query.subject);
      if (!assignedSubjectIds.some((id) => String(id) === targetSub)) {
        return sendError(res, {
          statusCode: HTTP_STATUS.FORBIDDEN,
          message: 'Access denied: You are not assigned to this subject',
          code: 'FORBIDDEN'
        });
      }
      activeSubjectIds = [new mongoose.Types.ObjectId(targetSub)];
    }

    // Query enrolled students
    const semesters = [...new Set(assignedSubjects.map((s) => Number(s.semester)).filter(Boolean))];
    const deptIds = [...new Set(assignedSubjects.map((s) => s.department?._id || s.department).filter(Boolean))];

    const studentFilter = {
      currentSemester: { $in: semesters }
    };
    if (deptIds.length > 0) studentFilter.department = { $in: deptIds };
    if (req.query.section) studentFilter.section = req.query.section;

    let students = await Student.find(studentFilter)
      .populate('user', 'name email')
      .populate('department', 'name code')
      .lean();

    // Query exam results & assignments for active subjects
    const studentIds = students.map((s) => s._id);
    const [results, assignments, attendance] = await Promise.all([
      Result.find({ subject: { $in: activeSubjectIds }, student: { $in: studentIds } }).populate('examination', 'name').lean(),
      Assignment.find({ subject: { $in: activeSubjectIds } }).lean(),
      Attendance.find({ subject: { $in: activeSubjectIds }, student: { $in: studentIds } }).lean()
    ]);

    const assignIds = assignments.map((a) => a._id);
    const submissions = await Submission.find({
      assignment: { $in: assignIds },
      student: { $in: studentIds }
    }).lean();

    const assignmentMap = new Map(assignments.map((a) => [String(a._id), a]));

    // Compute composite student metrics
    const studentRecords = students.map((st) => {
      const stId = String(st._id);

      // Exam scores
      const stResults = results.filter((r) => String(r.student) === stId);
      const examScores = stResults.map((r) => Number(r.totalMarks)).filter((m) => !isNaN(m) && m !== null);
      const examAvg = examScores.length > 0 ? Math.round((examScores.reduce((a, b) => a + b, 0) / examScores.length) * 10) / 10 : null;

      // Assignment scores
      const stSubs = submissions.filter((s) => String(s.student) === stId);
      const stEvaluatedSubs = stSubs.filter((s) => s.status === 'evaluated' && s.marksObtained !== null);
      const assignScores = stEvaluatedSubs.map((s) => {
        const assign = assignmentMap.get(String(s.assignment));
        const max = assign?.maxMarks || 20;
        return max > 0 ? (Number(s.marksObtained) / max) * 100 : 0;
      });
      const assignAvg = assignScores.length > 0 ? Math.round((assignScores.reduce((a, b) => a + b, 0) / assignScores.length) * 10) / 10 : null;

      // Attendance
      const stAtt = attendance.filter((a) => String(a.student) === stId);
      let attPresent = 0;
      let attLate = 0;
      stAtt.forEach((a) => {
        if (a.status === 'present') attPresent++;
        if (a.status === 'late') attLate++;
      });
      const attRate = stAtt.length > 0 ? Math.round(((attPresent + attLate * 0.5) / stAtt.length) * 100) : null;

      // Overall Composite (weighted: 50% exams + 50% assignments, or whichever exists)
      let overall = null;
      if (examAvg !== null && assignAvg !== null) {
        overall = Math.round((examAvg * 0.6 + assignAvg * 0.4) * 10) / 10;
      } else if (examAvg !== null) {
        overall = examAvg;
      } else if (assignAvg !== null) {
        overall = assignAvg;
      }

      // Performance Status & Transparent At-Risk Indicators
      const riskFlags = [];
      if (examAvg !== null && examAvg < 50) {
        riskFlags.push(`Low Exam Average (${examAvg}%)`);
      }
      if (assignAvg !== null && assignAvg < 50) {
        riskFlags.push(`Low Assignment Average (${assignAvg}%)`);
      }
      if (attRate !== null && attRate < 75) {
        riskFlags.push(`Low Attendance (${attRate}%)`);
      }

      // Check for unsubmitted past due assignments
      const now = new Date();
      const pastDueAssignments = assignments.filter((a) => a.dueDate && new Date(a.dueDate) < now);
      const submittedAssignIds = new Set(stSubs.map((s) => String(s.assignment)));
      const missingCount = pastDueAssignments.filter((a) => !submittedAssignIds.has(String(a._id))).length;
      if (missingCount > 0) {
        riskFlags.push(`Missing ${missingCount} Overdue Assignment${missingCount === 1 ? '' : 's'}`);
      }

      let performanceCategory = 'Good';
      if (riskFlags.length > 0 || (overall !== null && overall < 50)) {
        performanceCategory = 'Needs Attention';
      } else if (overall !== null && overall >= 80) {
        performanceCategory = 'Excellent';
      } else if (overall !== null && overall >= 65) {
        performanceCategory = 'Good';
      } else if (overall !== null) {
        performanceCategory = 'Average';
      } else {
        performanceCategory = 'Incomplete Data';
      }

      return {
        studentId: st._id,
        rollNumber: st.rollNumber,
        name: st.user?.name || 'Student',
        email: st.user?.email || '',
        department: st.department?.name || 'Computer Science & Engineering',
        semester: st.currentSemester,
        section: st.section || 'A',
        assignmentAverage: assignAvg,
        examinationAverage: examAvg,
        overallPerformance: overall,
        attendancePercentage: attRate,
        performanceCategory,
        riskFlags,
        isAtRisk: riskFlags.length > 0,
        evaluationsCount: examScores.length + assignScores.length
      };
    });

    // Filtering by search & performanceCategory
    let filtered = studentRecords;
    if (req.query.search) {
      const q = req.query.search.toLowerCase().trim();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q));
    }
    if (req.query.category && req.query.category !== 'all') {
      const cat = req.query.category.toLowerCase();
      if (cat === 'at_risk' || cat === 'needs attention') {
        filtered = filtered.filter((s) => s.isAtRisk || s.performanceCategory === 'Needs Attention');
      } else {
        filtered = filtered.filter((s) => s.performanceCategory.toLowerCase() === cat);
      }
    }

    // Sorting
    const sortBy = req.query.sortBy || 'rollNumber';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (valA === null || valA === undefined) valA = sortOrder === 1 ? 999999 : -999999;
      if (valB === null || valB === undefined) valB = sortOrder === 1 ? 999999 : -999999;
      if (typeof valA === 'string') return valA.localeCompare(valB) * sortOrder;
      return (valA - valB) * sortOrder;
    });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 10));
    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return sendSuccess(res, {
      message: 'Student performance list retrieved',
      data: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/faculty/me/analytics/students/:studentId
 * Deep-dive student detail: assessment breakdown (exams + assignments) and attendance history
 */
async function getStudentAnalyticsDetail(req, res, next) {
  try {
    const { faculty, assignedSubjectIds } = await getFacultyAndAssignedSubjects(req.user);

    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    const student = await Student.findById(req.params.studentId)
      .populate('user', 'name email')
      .populate('department', 'name code')
      .lean();

    if (!student) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Student record not found',
        code: 'NOT_FOUND'
      });
    }

    // Enforce student is enrolled in faculty's assigned courses
    const studentId = student._id;

    // 1. Examination Results for this student across faculty's subjects
    const examResults = await Result.find({
      student: studentId,
      subject: { $in: assignedSubjectIds }
    })
      .populate('examination', 'name examType startDate')
      .populate('subject', 'name code')
      .lean();

    // 2. Assignment Submissions for this student across faculty's subjects
    const assignments = await Assignment.find({
      subject: { $in: assignedSubjectIds }
    }).populate('subject', 'name code').lean();

    const assignmentIds = assignments.map((a) => a._id);
    const submissions = await Submission.find({
      assignment: { $in: assignmentIds },
      student: studentId
    }).lean();

    const subMap = new Map(submissions.map((s) => [String(s.assignment), s]));

    const assignmentDeliverables = assignments.map((a) => {
      const sub = subMap.get(String(a._id));
      const maxMarks = a.maxMarks || 20;
      const marks = sub?.marksObtained !== undefined && sub?.marksObtained !== null ? Number(sub.marksObtained) : null;
      const pct = marks !== null ? Math.round((marks / maxMarks) * 100) : null;

      return {
        assignmentId: a._id,
        title: a.title,
        subject: a.subject?.name || 'Course',
        subjectCode: a.subject?.code || 'SUB',
        maxMarks,
        dueDate: a.dueDate,
        isSubmitted: Boolean(sub),
        submittedAt: sub?.submittedAt || null,
        status: sub ? sub.status : 'unsubmitted',
        marksObtained: marks,
        percentage: pct,
        feedback: sub?.feedback || ''
      };
    });

    // 3. Attendance Sessions
    const attendanceRecords = await Attendance.find({
      student: studentId,
      subject: { $in: assignedSubjectIds }
    }).populate('subject', 'name code').sort({ date: -1 }).lean();

    let present = 0;
    let absent = 0;
    let late = 0;
    attendanceRecords.forEach((r) => {
      if (r.status === 'present') present++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'late') late++;
    });
    const totalSessions = attendanceRecords.length;
    const attPercentage = totalSessions > 0 ? Math.round(((present + late * 0.5) / totalSessions) * 100) : 100;

    return sendSuccess(res, {
      message: 'Student assessment analytics retrieved',
      data: {
        student: {
          _id: student._id,
          rollNumber: student.rollNumber,
          name: student.user?.name || 'Student',
          email: student.user?.email || '',
          department: student.department?.name,
          semester: student.currentSemester,
          section: student.section || 'A'
        },
        examinations: examResults.map((r) => ({
          resultId: r._id,
          examName: r.examination?.name || 'Institutional Exam',
          examType: r.examination?.examType || 'Semester End',
          subject: r.subject?.name,
          subjectCode: r.subject?.code,
          internalMarks: r.internalMarks,
          externalMarks: r.externalMarks,
          totalMarks: r.totalMarks,
          grade: r.grade,
          status: r.status,
          date: r.examination?.startDate
        })),
        assignments: assignmentDeliverables,
        attendance: {
          totalSessions,
          present,
          absent,
          late,
          percentage: attPercentage,
          records: attendanceRecords.slice(0, 10)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/faculty/me/analytics/trends
 * Aggregates trend visualizations: assessment timeline, subject comparison, grade distribution
 */
async function getAnalyticsTrends(req, res, next) {
  try {
    const { faculty, assignedSubjectIds, assignedSubjects } = await getFacultyAndAssignedSubjects(req.user);

    if (!faculty) {
      return sendError(res, {
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No faculty profile associated with this account',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    if (assignedSubjectIds.length === 0) {
      return sendSuccess(res, {
        data: {
          assessmentTrend: [],
          subjectComparison: [],
          gradeDistribution: [],
          assignmentVsExam: []
        }
      });
    }

    // 1. Grade distribution across all exam results for faculty's subjects
    const results = await Result.find({ subject: { $in: assignedSubjectIds } }).lean();
    const gradeBuckets = { 'O': 0, 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'F': 0 };
    results.forEach((r) => {
      const g = (r.grade || 'B').toUpperCase();
      if (gradeBuckets[g] !== undefined) gradeBuckets[g] += 1;
      else gradeBuckets['B'] += 1;
    });

    const gradeDistribution = Object.entries(gradeBuckets).map(([grade, count]) => ({
      grade,
      count
    }));

    // 2. Subject comparison (average score % per subject)
    const subjectComparison = await Promise.all(
      assignedSubjects.map(async (sub) => {
        const subResults = results.filter((r) => String(r.subject) === String(sub._id));
        const scores = subResults.map((r) => Number(r.totalMarks)).filter((m) => !isNaN(m) && m !== null);
        const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
        return {
          code: sub.code,
          name: sub.name,
          averageScore: avg,
          evaluatedCount: scores.length
        };
      })
    );

    // 3. Assessment Trend Timeline
    const exams = await Exam.find({}).sort({ startDate: 1 }).lean();
    const assessmentTrend = exams
      .map((ex) => {
        const exResults = results.filter((r) => String(r.examination) === String(ex._id));
        const marks = exResults.map((r) => Number(r.totalMarks)).filter((m) => !isNaN(m) && m !== null);
        if (marks.length === 0) return null;
        return {
          name: ex.name,
          date: ex.startDate ? new Date(ex.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Exam',
          average: Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 10) / 10,
          count: marks.length
        };
      })
      .filter(Boolean);

    // 4. Performance distribution (ranges: 90-100, 75-89, 60-74, 40-59, <40)
    const ranges = {
      '90 - 100%': 0,
      '75 - 89%': 0,
      '60 - 74%': 0,
      '40 - 59%': 0,
      'Below 40%': 0
    };
    results.forEach((r) => {
      const m = Number(r.totalMarks);
      if (!isNaN(m) && m !== null) {
        if (m >= 90) ranges['90 - 100%'] += 1;
        else if (m >= 75) ranges['75 - 89%'] += 1;
        else if (m >= 60) ranges['60 - 74%'] += 1;
        else if (m >= 40) ranges['40 - 59%'] += 1;
        else ranges['Below 40%'] += 1;
      }
    });

    const performanceRanges = Object.entries(ranges).map(([range, count]) => ({
      range,
      count
    }));

    return sendSuccess(res, {
      message: 'Performance trend visualizations retrieved',
      data: {
        assessmentTrend,
        subjectComparison,
        gradeDistribution,
        performanceRanges
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAnalyticsOverview,
  getSubjectAnalytics,
  getStudentPerformanceList,
  getStudentAnalyticsDetail,
  getAnalyticsTrends
};
