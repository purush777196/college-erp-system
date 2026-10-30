const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Universal API Client with automatic Authorization Bearer header injection
 */
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.pendingRequests = new Map();
    this.lastUnauthorizedEvent = 0;
  }

  dispatchUnauthorized() {
    const now = Date.now();
    if (now - this.lastUnauthorizedEvent > 2000) {
      this.lastUnauthorizedEvent = now;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }
  }

  getToken() {
    return localStorage.getItem('college_erp_token');
  }

  isTokenExpired(token) {
    if (!token || typeof token !== 'string') return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      if (!payload.exp) return false;
      return payload.exp * 1000 < Date.now();
    } catch {
      return false;
    }
  }

  async request(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    // Deduplicate identical concurrent in-flight GET requests
    const cacheKey = method === 'GET' ? `${cleanEndpoint}:${JSON.stringify(options.headers || {})}` : null;
    if (cacheKey && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    const executeRequest = async () => {
      const token = this.getToken();

      const isPublic =
        cleanEndpoint === '/health' ||
        cleanEndpoint.endsWith('/health') ||
        cleanEndpoint.startsWith('/v1/auth/login') ||
        cleanEndpoint.startsWith('/v1/auth/register') ||
        cleanEndpoint.startsWith('/auth/login') ||
        cleanEndpoint.startsWith('/auth/register');

      if (!isPublic) {
        if (!token) {
          const error = new Error('No authentication token found. Please log in.');
          error.status = 401;
          error.code = 'NO_TOKEN';
          throw error;
        }

        if (this.isTokenExpired(token)) {
          localStorage.removeItem('college_erp_token');
          localStorage.removeItem('college_erp_user');
          this.dispatchUnauthorized();
          const error = new Error('Session expired. Please log in again.');
          error.status = 401;
          error.code = 'TOKEN_EXPIRED';
          throw error;
        }
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      };

      const config = {
        ...options,
        headers
      };

      if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
      }

      try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const error = new Error(data.message || `Request failed with status ${response.status}`);
          error.status = response.status;
          error.data = data;
          throw error;
        }

        return data;
      } catch (error) {
        if (error.status === 401 && error.code !== 'NO_TOKEN' && !cleanEndpoint.startsWith('/v1/auth/login')) {
          localStorage.removeItem('college_erp_token');
          localStorage.removeItem('college_erp_user');
          this.dispatchUnauthorized();
        }
        throw error;
      }
    };

    if (cacheKey) {
      const promise = executeRequest().finally(() => {
        this.pendingRequests.delete(cacheKey);
      });
      this.pendingRequests.set(cacheKey, promise);
      return promise;
    }

    return executeRequest();
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // Common authentication endpoints
  checkHealth() {
    return this.get('/health');
  }

  login(credentials) {
    return this.post('/v1/auth/login', credentials);
  }

  getCurrentUser() {
    return this.get('/v1/auth/me');
  }

  changePassword(currentPassword, newPassword) {
    return this.post('/v1/auth/change-password', { currentPassword, newPassword });
  }

  // User Management endpoints (Super Admin)
  getUsers(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.role) searchParams.append('role', params.role);
    if (params.department) {
      const dept = typeof params.department === 'object' && params.department !== null
        ? (params.department._id || params.department.id || '')
        : String(params.department).trim();
      if (dept && dept !== '[object Object]') {
        searchParams.append('department', dept);
      }
    }
    if (params.status) searchParams.append('status', params.status);
    if (params.q) searchParams.append('q', params.q);

    const qs = searchParams.toString();
    return this.get(`/v1/users${qs ? `?${qs}` : ''}`);
  }

  getUserById(id) {
    return this.get(`/v1/users/${id}`);
  }

  createUser(userData) {
    return this.post('/v1/users', userData);
  }

  updateUser(id, userData) {
    return this.put(`/v1/users/${id}`, userData);
  }

  updateUserStatus(id, status) {
    return this.patch(`/v1/users/${id}/status`, { status });
  }

  resetUserPassword(id, newPassword) {
    return this.post(`/v1/users/${id}/reset-password`, { newPassword });
  }

  // Reports & Live Executive Metrics
  getAdminOverview() {
    return this.get('/v1/reports/admin-overview');
  }

  getDepartmentSummaries() {
    return this.get('/v1/reports/department-summaries');
  }

  getAcademicSummary() {
    return this.get('/v1/reports/academic-summary');
  }

  getAttendanceOverview() {
    return this.get('/v1/reports/attendance-overview');
  }

  getFeeCollectionSummary() {
    return this.get('/v1/reports/fee-collection');
  }

  // Departments
  getDepartments() {
    return this.get('/v1/departments');
  }

  getDepartmentById(id) {
    return this.get(`/v1/departments/${id}`);
  }

  createDepartment(data) {
    return this.post('/v1/departments', data);
  }

  updateDepartment(id, data) {
    return this.put(`/v1/departments/${id}`, data);
  }

  // Courses & Subjects
  getCourses() {
    return this.get('/v1/courses');
  }

  createCourse(data) {
    return this.post('/v1/courses', data);
  }

  updateCourse(id, data) {
    return this.put(`/v1/courses/${id}`, data);
  }

  deleteCourse(id) {
    return this.delete(`/v1/courses/${id}`);
  }

  getSubjects(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.course) searchParams.append('course', params.course);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.department) searchParams.append('department', params.department);
    const qs = searchParams.toString();
    return this.get(`/v1/subjects${qs ? `?${qs}` : ''}`);
  }

  createSubject(data) {
    return this.post('/v1/subjects', data);
  }

  updateSubject(id, data) {
    return this.put(`/v1/subjects/${id}`, data);
  }

  deleteSubject(id) {
    return this.delete(`/v1/subjects/${id}`);
  }

  // Faculty
  getFaculty(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.department) searchParams.append('department', params.department);
    if (params.designation) searchParams.append('designation', params.designation);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty${qs ? `?${qs}` : ''}`);
  }

  getFacultyById(id) {
    return this.get(`/v1/faculty/${id}`);
  }

  getMyFacultyProfile() {
    return this.get('/v1/faculty/me');
  }

  getMyFacultyActivities() {
    return this.get('/v1/faculty/me/activities');
  }

  getMyAssignedSubjects(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty/me/assigned-subjects${qs ? `?${qs}` : ''}`);
  }

  getAssignedSubjectStudents(subjectId) {
    return this.get(`/v1/faculty/me/assigned-subjects/${subjectId}/students`);
  }

  createFaculty(data) {
    return this.post('/v1/faculty', data);
  }

  updateFaculty(id, data) {
    return this.put(`/v1/faculty/${id}`, data);
  }

  // Students
  getStudents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.department) searchParams.append('department', params.department);
    if (params.course) searchParams.append('course', params.course);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.batch) searchParams.append('batch', params.batch);
    if (params.status) searchParams.append('status', params.status);
    if (params.q) searchParams.append('q', params.q);

    const qs = searchParams.toString();
    return this.get(`/v1/students${qs ? `?${qs}` : ''}`);
  }

  getStudentById(id) {
    return this.get(`/v1/students/${id}`);
  }

  getMyStudentProfile() {
    return this.get('/v1/students/me');
  }

  createStudent(data) {
    return this.post('/v1/students', data);
  }

  updateStudent(id, data) {
    return this.put(`/v1/students/${id}`, data);
  }

  // Fees & Payments
  getFeeStructures(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.department) searchParams.append('department', params.department);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.academicYear) searchParams.append('academicYear', params.academicYear);
    if (params.status) searchParams.append('status', params.status);
    if (params.feeCategory) searchParams.append('feeCategory', params.feeCategory);
    const qs = searchParams.toString();
    return this.get(`/v1/fees/structures${qs ? `?${qs}` : ''}`);
  }

  getFeeStructureById(id) {
    return this.get(`/v1/fees/structures/${id}`);
  }

  createFeeStructure(data) {
    return this.post('/v1/fees/structures', data);
  }

  updateFeeStructure(id, data) {
    return this.put(`/v1/fees/structures/${id}`, data);
  }

  archiveFeeStructure(id) {
    return this.patch(`/v1/fees/structures/${id}/archive`, {});
  }

  // Invoices & Dues
  getFeeInvoices(params = {}) {
    return this.getInvoices(params);
  }

  getInvoices(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.student) searchParams.append('student', params.student);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.academicYear) searchParams.append('academicYear', params.academicYear);
    if (params.status) searchParams.append('status', params.status);
    if (params.feeCategory) searchParams.append('feeCategory', params.feeCategory);
    const qs = searchParams.toString();
    return this.get(`/v1/fees/invoices${qs ? `?${qs}` : ''}`);
  }

  getInvoiceById(id) {
    return this.get(`/v1/fees/invoices/${id}`);
  }

  createInvoice(data) {
    return this.post('/v1/fees/invoices', data);
  }

  applyInvoiceAdjustment(id, data) {
    return this.post(`/v1/fees/invoices/${id}/adjustments`, data);
  }

  // Payments & Receipts
  getGatewayStatus() {
    return this.get('/v1/payments/gateway-status');
  }

  getPayments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.student) searchParams.append('student', params.student);
    if (params.status) searchParams.append('status', params.status);
    if (params.paymentMethod) searchParams.append('paymentMethod', params.paymentMethod);
    const qs = searchParams.toString();
    return this.get(`/v1/payments${qs ? `?${qs}` : ''}`);
  }

  recordPayment(data) {
    return this.post('/v1/payments', data);
  }

  getReceipt(paymentId) {
    return this.get(`/v1/payments/${paymentId}/receipt`);
  }

  processRefund(paymentId, data) {
    return this.post(`/v1/payments/${paymentId}/refund`, data);
  }

  // Notices
  getNotices(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.append('q', params.q);
    if (params.category) searchParams.append('category', params.category);
    if (params.priority) searchParams.append('priority', params.priority);
    if (params.status) searchParams.append('status', params.status);
    if (params.department) searchParams.append('department', params.department);
    const qs = searchParams.toString();
    return this.get(`/v1/notices${qs ? `?${qs}` : ''}`);
  }

  getNoticeById(id) {
    return this.get(`/v1/notices/${id}`);
  }

  createNotice(data) {
    return this.post('/v1/notices', data);
  }

  updateNotice(id, data) {
    return this.put(`/v1/notices/${id}`, data);
  }

  publishNotice(id) {
    return this.patch(`/v1/notices/${id}/publish`, {});
  }

  archiveNotice(id) {
    return this.patch(`/v1/notices/${id}/archive`, {});
  }

  // Security & Audit Logs
  getAuditLogs(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.action) searchParams.append('action', params.action);
    if (params.entityType) searchParams.append('entityType', params.entityType);
    if (params.outcome) searchParams.append('outcome', params.outcome);
    if (params.actor) searchParams.append('actor', params.actor);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.q) searchParams.append('q', params.q);
    const qs = searchParams.toString();
    return this.get(`/v1/audit-logs${qs ? `?${qs}` : ''}`);
  }

  getAuditLogById(id) {
    return this.get(`/v1/audit-logs/${id}`);
  }

  // Data-backed Institutional Reports
  getEnrollmentReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.department) searchParams.append('department', params.department);
    if (params.course) searchParams.append('course', params.course);
    if (params.semester) searchParams.append('semester', params.semester);
    const qs = searchParams.toString();
    return this.get(`/v1/reports/enrollment${qs ? `?${qs}` : ''}`);
  }

  getFacultyAllocationReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.department) searchParams.append('department', params.department);
    const qs = searchParams.toString();
    return this.get(`/v1/reports/faculty-allocation${qs ? `?${qs}` : ''}`);
  }

  getAttendanceReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.subject) searchParams.append('subject', params.subject);
    const qs = searchParams.toString();
    return this.get(`/v1/reports/attendance${qs ? `?${qs}` : ''}`);
  }

  getExaminationsReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYear) searchParams.append('academicYear', params.academicYear);
    if (params.semester) searchParams.append('semester', params.semester);
    const qs = searchParams.toString();
    return this.get(`/v1/reports/examinations${qs ? `?${qs}` : ''}`);
  }

  getResultsSummaryReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.examination) searchParams.append('examination', params.examination);
    const qs = searchParams.toString();
    return this.get(`/v1/reports/results${qs ? `?${qs}` : ''}`);
  }

  getFinancialReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYear) searchParams.append('academicYear', params.academicYear);
    if (params.semester) searchParams.append('semester', params.semester);
    const qs = searchParams.toString();
    return this.get(`/v1/reports/financial${qs ? `?${qs}` : ''}`);
  }

  getAdminActivityReport(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    const qs = searchParams.toString();
    return this.get(`/v1/reports/admin-activity${qs ? `?${qs}` : ''}`);
  }

  // Timetable, Exams & Results
  getTimetable(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.department) searchParams.append('department', params.department);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.faculty) searchParams.append('faculty', params.faculty);
    if (params.dayOfWeek) searchParams.append('dayOfWeek', params.dayOfWeek);
    const qs = searchParams.toString();
    return this.get(`/v1/timetable${qs ? `?${qs}` : ''}`);
  }

  createTimetableSlot(data) {
    return this.post('/v1/timetable', data);
  }

  updateTimetableSlot(id, data) {
    return this.put(`/v1/timetable/${id}`, data);
  }

  deleteTimetableSlot(id) {
    return this.delete(`/v1/timetable/${id}`);
  }

  createExam(data) {
    return this.post('/v1/examinations', data);
  }

  updateExam(id, data) {
    return this.put(`/v1/examinations/${id}`, data);
  }

  deleteExam(id) {
    return this.delete(`/v1/examinations/${id}`);
  }

  getExams(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.academicYear) searchParams.append('academicYear', params.academicYear);
    const qs = searchParams.toString();
    return this.get(`/v1/examinations${qs ? `?${qs}` : ''}`);
  }

  recordResult(data) {
    return this.post('/v1/results', data);
  }

  batchRecordResults(data) {
    return this.post('/v1/results/batch', data);
  }

  getResults(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.examination) searchParams.append('examination', params.examination);
    if (params.student) searchParams.append('student', params.student);
    if (params.subject) searchParams.append('subject', params.subject);
    const qs = searchParams.toString();
    return this.get(`/v1/results${qs ? `?${qs}` : ''}`);
  }

  getAttendance(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.student) searchParams.append('student', params.student);
    if (params.subject) searchParams.append('subject', params.subject);
    const qs = searchParams.toString();
    return this.get(`/v1/attendance${qs ? `?${qs}` : ''}`);
  }

  markAttendanceBatch(data) {
    return this.post('/v1/attendance/mark', data);
  }

  getAttendanceSummary(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.student) searchParams.append('student', params.student);
    if (params.subject) searchParams.append('subject', params.subject);
    if (params.department) searchParams.append('department', params.department);
    if (params.departmentId) searchParams.append('departmentId', params.departmentId);
    const qs = searchParams.toString();
    return this.get(`/v1/attendance/summary${qs ? `?${qs}` : ''}`);
  }

  // Assignment & Student Submission Management
  getAssignments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.append('subject', params.subject);
    if (params.semester) searchParams.append('semester', params.semester);
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.get(`/v1/assignments${qs ? `?${qs}` : ''}`);
  }

  getAssignmentById(id) {
    return this.get(`/v1/assignments/${id}`);
  }

  createAssignment(data) {
    return this.post('/v1/assignments', data);
  }

  updateAssignment(id, data) {
    return this.put(`/v1/assignments/${id}`, data);
  }

  deleteAssignment(id) {
    return this.delete(`/v1/assignments/${id}`);
  }

  publishAssignment(id) {
    return this.patch(`/v1/assignments/${id}/publish`, {});
  }

  getAssignmentSubmissions(id) {
    return this.get(`/v1/assignments/${id}/submissions`);
  }

  evaluateAssignmentSubmission(assignmentId, submissionId, data) {
    return this.post(`/v1/assignments/${assignmentId}/submissions/${submissionId}/evaluate`, data);
  }

  submitAssignment(id, data) {
    return this.post(`/v1/assignments/${id}/submit`, data);
  }

  // Syllabus Progress Management
  getSubjectSyllabus(subjectId) {
    return this.get(`/v1/syllabus/subject/${subjectId}`);
  }

  updateUnitProgress(subjectId, unitNumber, data) {
    return this.patch(`/v1/syllabus/subject/${subjectId}/unit/${unitNumber}`, data);
  }

  getFacultySyllabusSummary() {
    return this.get('/v1/syllabus/faculty/summary');
  }

  // Learning Material Management (Phase 4)
  getMaterials(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.append('subject', params.subject);
    if (params.unitNumber) searchParams.append('unitNumber', params.unitNumber);
    if (params.category) searchParams.append('category', params.category);
    if (params.resourceType) searchParams.append('resourceType', params.resourceType);
    if (params.fileType) searchParams.append('fileType', params.fileType);
    if (params.visibility) searchParams.append('visibility', params.visibility);
    if (params.publicationStatus) searchParams.append('publicationStatus', params.publicationStatus);
    if (params.search) searchParams.append('search', params.search);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return this.get(`/v1/materials${qs ? `?${qs}` : ''}`);
  }

  getMaterialById(id) {
    return this.get(`/v1/materials/${id}`);
  }

  createMaterial(data) {
    return this.post('/v1/materials', data);
  }

  updateMaterial(id, data) {
    return this.put(`/v1/materials/${id}`, data);
  }

  deleteMaterial(id) {
    return this.delete(`/v1/materials/${id}`);
  }

  publishMaterial(id) {
    return this.patch(`/v1/materials/${id}/publish`, {});
  }

  archiveMaterial(id) {
    return this.patch(`/v1/materials/${id}/archive`, {});
  }

  restoreMaterial(id) {
    return this.patch(`/v1/materials/${id}/restore`, {});
  }

  getMaterialStats(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.append('subject', params.subject);
    const qs = searchParams.toString();
    return this.get(`/v1/materials/stats${qs ? `?${qs}` : ''}`);
  }

  async downloadMaterialBlob(id, filename) {
    const token = this.getToken();
    const response = await fetch(`${this.baseURL}/v1/materials/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || 'Download failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'resource';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Student Appointment System (Phase 5)
  getFacultyAvailability() {
    return this.get('/v1/faculty/me/appointments/availability');
  }

  updateFacultyAvailability(data) {
    return this.put('/v1/faculty/me/appointments/availability', data);
  }

  getFacultyAvailableSlots(date) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.get(`/v1/faculty/me/appointments/availability/slots${qs}`);
  }

  getFacultyAppointments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.appointmentType) searchParams.append('appointmentType', params.appointmentType);
    if (params.date) searchParams.append('date', params.date);
    if (params.search) searchParams.append('search', params.search);
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty/me/appointments${qs ? `?${qs}` : ''}`);
  }

  getFacultyAppointmentSummary() {
    return this.get('/v1/faculty/me/appointments/summary');
  }

  getFacultyCalendarAppointments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.month) searchParams.append('month', params.month);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty/me/appointments/calendar${qs ? `?${qs}` : ''}`);
  }

  getFacultyAppointmentById(id) {
    return this.get(`/v1/faculty/me/appointments/${id}`);
  }

  approveAppointment(id, data = {}) {
    return this.patch(`/v1/faculty/me/appointments/${id}/approve`, data);
  }

  rejectAppointment(id, data = {}) {
    return this.patch(`/v1/faculty/me/appointments/${id}/reject`, data);
  }

  rescheduleAppointment(id, data) {
    return this.patch(`/v1/faculty/me/appointments/${id}/reschedule`, data);
  }

  cancelAppointment(id, data = {}) {
    return this.patch(`/v1/faculty/me/appointments/${id}/cancel`, data);
  }

  completeAppointment(id, data = {}) {
    return this.patch(`/v1/faculty/me/appointments/${id}/complete`, data);
  }

  saveAppointmentNotes(id, data) {
    return this.post(`/v1/faculty/me/appointments/${id}/notes`, data);
  }

  createStudentAppointment(data) {
    return this.post('/v1/student/appointments', data);
  }

  getStudentAppointments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return this.get(`/v1/student/appointments${qs ? `?${qs}` : ''}`);
  }

  getStudentAppointmentSummary() {
    return this.get('/v1/student/appointments/summary');
  }

  getStudentAssociatedFaculty() {
    return this.get('/v1/student/appointments/faculty');
  }

  getStudentFacultyAvailability(facultyId, date) {
    return this.get(`/v1/student/appointments/faculty/${facultyId}/availability/${date}/slots`);
  }

  getStudentAppointmentById(id) {
    return this.get(`/v1/student/appointments/${id}`);
  }

  cancelStudentAppointment(id, data = {}) {
    return this.patch(`/v1/student/appointments/${id}/cancel`, data);
  }

  // Faculty Student Performance Analytics (Phase 2)
  getFacultyAnalyticsOverview(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.append('subject', params.subject);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty/me/analytics/overview${qs ? `?${qs}` : ''}`);
  }

  getFacultyAnalyticsSubjects() {
    return this.get('/v1/faculty/me/analytics/subjects');
  }

  getFacultyAnalyticsStudents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.subject) searchParams.append('subject', params.subject);
    if (params.section) searchParams.append('section', params.section);
    if (params.category) searchParams.append('category', params.category);
    if (params.search) searchParams.append('search', params.search);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty/me/analytics/students${qs ? `?${qs}` : ''}`);
  }

  getFacultyAnalyticsStudentDetail(studentId) {
    return this.get(`/v1/faculty/me/analytics/students/${studentId}`);
  }

  getFacultyAnalyticsTrends() {
    return this.get('/v1/faculty/me/analytics/trends');
  }

  // Smart Syllabus Tracker (Phase 3)
  getFacultySyllabusSummaries() {
    return this.get('/v1/syllabus/faculty/summary');
  }

  getSubjectSyllabus(subjectId) {
    return this.get(`/v1/syllabus/subject/${subjectId}`);
  }

  initializeSubjectSyllabus(subjectId) {
    return this.post(`/v1/syllabus/subject/${subjectId}/initialize`);
  }

  getSyllabusProgressAnalytics(subjectId) {
    return this.get(`/v1/syllabus/subject/${subjectId}/progress`);
  }

  getSyllabusHistory(subjectId, params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return this.get(`/v1/syllabus/subject/${subjectId}/history${qs ? `?${qs}` : ''}`);
  }

  createSyllabusUnit(subjectId, data) {
    return this.post(`/v1/syllabus/subject/${subjectId}/units`, data);
  }

  updateSyllabusUnit(subjectId, unitId, data) {
    return this.put(`/v1/syllabus/subject/${subjectId}/units/${unitId}`, data);
  }

  deleteSyllabusUnit(subjectId, unitId) {
    return this.delete(`/v1/syllabus/subject/${subjectId}/units/${unitId}`);
  }

  createSyllabusTopic(subjectId, unitId, data) {
    return this.post(`/v1/syllabus/subject/${subjectId}/units/${unitId}/topics`, data);
  }

  updateSyllabusTopic(subjectId, unitId, topicId, data) {
    return this.put(`/v1/syllabus/subject/${subjectId}/units/${unitId}/topics/${topicId}`, data);
  }

  deleteSyllabusTopic(subjectId, unitId, topicId) {
    return this.delete(`/v1/syllabus/subject/${subjectId}/units/${unitId}/topics/${topicId}`);
  }

  updateUnitProgressLegacy(subjectId, unitNumber, data) {
    return this.patch(`/v1/syllabus/subject/${subjectId}/unit/${unitNumber}`, data);
  }

  // Phase 6: Academic Calendar & Personal Events
  getFacultyCalendarEvents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.category && params.category !== 'all') searchParams.append('category', params.category);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty/me/calendar/events${qs ? `?${qs}` : ''}`);
  }

  createFacultyPersonalEvent(data) {
    return this.post('/v1/faculty/me/calendar/events', data);
  }

  getFacultyPersonalEvent(eventId) {
    return this.get(`/v1/faculty/me/calendar/events/${eventId}`);
  }

  updateFacultyPersonalEvent(eventId, data) {
    return this.patch(`/v1/faculty/me/calendar/events/${eventId}`, data);
  }

  deleteFacultyPersonalEvent(eventId) {
    return this.delete(`/v1/faculty/me/calendar/events/${eventId}`);
  }

  // Phase 6: Faculty Notifications & Reminders
  getFacultyNotifications(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.unreadOnly) searchParams.append('unreadOnly', params.unreadOnly);
    if (params.category) searchParams.append('category', params.category);
    if (params.limit) searchParams.append('limit', params.limit);
    if (params.page) searchParams.append('page', params.page);
    const qs = searchParams.toString();
    return this.get(`/v1/faculty/me/notifications${qs ? `?${qs}` : ''}`);
  }

  getFacultyUnreadNotificationCount() {
    return this.get('/v1/faculty/me/notifications/unread-count');
  }

  markFacultyNotificationAsRead(notificationId) {
    return this.patch(`/v1/faculty/me/notifications/${notificationId}/read`);
  }

  markAllFacultyNotificationsAsRead() {
    return this.patch('/v1/faculty/me/notifications/read-all');
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
