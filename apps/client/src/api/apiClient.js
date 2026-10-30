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
}

export const api = new ApiClient(API_BASE_URL);
export default api;
