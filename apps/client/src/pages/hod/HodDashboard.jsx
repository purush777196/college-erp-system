import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Users,
  BookOpen,
  CalendarCheck,
  Award,
  Clock,
  Layers,
  Building2,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  RefreshCw,
  Edit2,
  Key,
  UserCheck,
  UserX,
  Mail,
  ShieldAlert,
  GraduationCap,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  Search,
  Download,
  AlertCircle,
  FileText,
  Bell,
  Compass,
  ArrowUpRight,
  Filter,
  Calendar,
  Sparkles,
  Check,
  X,
  RotateCcw,
  Eye,
  Grid,
  List,
  Briefcase,
  Phone,
  MapPin,
  Hash,
  SlidersHorizontal
} from 'lucide-react';
import Card from '../../components/common/Card';
import CampusBuildingGraphic from '../../components/common/CampusBuildingGraphic';
import SimpleBarChart from '../../components/common/SimpleBarChart';
import SimpleDonutChart from '../../components/common/SimpleDonutChart';
import StatWidget from '../../components/common/StatWidget';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Notification from '../../components/common/Notification';
import api from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLES, USER_STATUS, DEPARTMENTS } from '@college-erp/shared';
import { exportToCsv } from '../../utils/csvExport';

function formatTimeAgo(dateString) {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'just now';
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAuditLogDisplay(log) {
  const action = log?.action || '';
  if (action.includes('LOGIN') || action.includes('AUTH')) {
    return { title: `User ${log.details?.email || 'officer'} authenticated`, icon: Key, color: 'text-indigo-600 bg-indigo-50' };
  }
  if (action.includes('SUBJECT')) {
    return { title: `Curriculum updated: ${log.details?.name || log.details?.code || 'Subject'}`, icon: BookOpen, color: 'text-amber-600 bg-amber-50' };
  }
  if (action.includes('TIMETABLE')) {
    return { title: 'Department timetable slot updated', icon: Clock, color: 'text-blue-600 bg-blue-50' };
  }
  if (action.includes('ATTENDANCE')) {
    return { title: 'Class attendance recorded', icon: CalendarCheck, color: 'text-emerald-600 bg-emerald-50' };
  }
  if (action.includes('RESULT')) {
    return { title: 'Student marks registered', icon: Award, color: 'text-purple-600 bg-purple-50' };
  }
  if (action.includes('EXAM')) {
    return { title: `Examination scheduled: ${log.details?.name || 'Academic'}`, icon: Layers, color: 'text-sky-600 bg-sky-50' };
  }
  if (action.includes('NOTICE')) {
    return { title: 'Notice circular released', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' };
  }
  return {
    title: action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || 'System operation executed',
    icon: Layers,
    color: 'text-slate-600 bg-slate-50'
  };
}

export const HodDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [hodUsers, setHodUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Feature A, B, C supplementary records
  const [resultsList, setResultsList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [allExams, setAllExams] = useState([]);
  const [allNotices, setAllNotices] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [isPublishingNotice, setIsPublishingNotice] = useState(false);

  // Tab and filter states
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [hodActiveTab, setHodActiveTab] = useState(
    queryTab === 'roster'
      ? 'faculty'
      : queryTab === 'cohort' || queryTab === 'student-cohort'
      ? 'students'
      : queryTab === 'timetable' || queryTab === 'schedule' || queryTab === 'department-timetable'
      ? 'timetable'
      : queryTab === 'curriculum' || queryTab === 'syllabus' || queryTab === 'subjects'
      ? 'syllabus'
      : queryTab === 'alerts' || queryTab === 'academic-alerts' || queryTab === 'insights'
      ? 'alerts'
      : (queryTab || 'faculty')
  );

  const [facultySearch, setFacultySearch] = useState('');
  const [facultyDesignation, setFacultyDesignation] = useState('All');
  const [facultyStatusFilter, setFacultyStatusFilter] = useState('All');
  const [facultySortBy, setFacultySortBy] = useState('name-asc');
  const [facultyViewMode, setFacultyViewMode] = useState('table');
  const [selectedFacultyDetails, setSelectedFacultyDetails] = useState(null);
  const [isRefreshingFaculty, setIsRefreshingFaculty] = useState(false);
  const [facultyFetchError, setFacultyFetchError] = useState(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [studentSemester, setStudentSemester] = useState('All');
  const [studentBatchFilter, setStudentBatchFilter] = useState('All');
  const [studentStatusFilter, setStudentStatusFilter] = useState('All');
  const [studentSortBy, setStudentSortBy] = useState('roll-asc');
  const [studentViewMode, setStudentViewMode] = useState('table');
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  const [isRefreshingStudents, setIsRefreshingStudents] = useState(false);
  const [studentFetchError, setStudentFetchError] = useState(null);

  const [timetableSearch, setTimetableSearch] = useState('');
  const [timetableDay, setTimetableDay] = useState('All');
  const [timetableSemester, setTimetableSemester] = useState('All');
  const [timetableSection, setTimetableSection] = useState('All');
  const [timetableFaculty, setTimetableFaculty] = useState('All');
  const [timetableType, setTimetableType] = useState('All');
  const [timetableSortBy, setTimetableSortBy] = useState('chronological');
  const [timetableTabMode, setTimetableTabMode] = useState('grouped');
  const [selectedTimetableSlot, setSelectedTimetableSlot] = useState(null);
  const [isRefreshingTimetable, setIsRefreshingTimetable] = useState(false);
  const [timetableFetchError, setTimetableFetchError] = useState(null);

  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectSemester, setSubjectSemester] = useState('All');
  const [subjectType, setSubjectType] = useState('All');
  const [subjectCreditsFilter, setSubjectCreditsFilter] = useState('All');
  const [subjectStatusFilter, setSubjectStatusFilter] = useState('All');
  const [subjectSortBy, setSubjectSortBy] = useState('code-asc');
  const [subjectViewMode, setSubjectViewMode] = useState('table');
  const [selectedSubjectDetails, setSelectedSubjectDetails] = useState(null);
  const [isRefreshingCurriculum, setIsRefreshingCurriculum] = useState(false);
  const [curriculumFetchError, setCurriculumFetchError] = useState(null);

  // Academic alerts & compliance filters
  const [alertsSearch, setAlertsSearch] = useState('');
  const [alertsCategoryFilter, setAlertsCategoryFilter] = useState('All');
  const [alertsSeverityFilter, setAlertsSeverityFilter] = useState('All');
  const [alertsStatusFilter, setAlertsStatusFilter] = useState('All');
  const [alertsSemesterFilter, setAlertsSemesterFilter] = useState('All');
  const [alertsSortBy, setAlertsSortBy] = useState('priority-desc');
  const [selectedAlertDetails, setSelectedAlertDetails] = useState(null);
  const [isRefreshingAlerts, setIsRefreshingAlerts] = useState(false);
  const [alertsFetchError, setAlertsFetchError] = useState(null);
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState(() => {
    try {
      const saved = localStorage.getItem('hod_acknowledged_alerts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleToggleAcknowledgeAlert = (alertId) => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      const isAck = next.has(alertId);
      if (isAck) {
        next.delete(alertId);
        addToast({
          type: 'info',
          title: 'Alert Reopened',
          message: 'The alert has been returned to pending attention status.'
        });
      } else {
        next.add(alertId);
        addToast({
          type: 'success',
          title: 'Alert Acknowledged',
          message: 'The alert has been marked as reviewed by HOD.'
        });
      }
      try {
        localStorage.setItem('hod_acknowledged_alerts', JSON.stringify(Array.from(next)));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  // Legacy insights filters (for backwards compatibility)
  const [performanceSearch, setPerformanceSearch] = useState('');
  const [performanceTypeFilter, setPerformanceTypeFilter] = useState('All');
  const [performanceSemester, setPerformanceSemester] = useState('All');
  const [deadlinesFilter, setDeadlinesFilter] = useState('All');

  useEffect(() => {
    if (queryTab) {
      if (queryTab === 'roster') {
        setHodActiveTab('faculty');
      } else if (queryTab === 'cohort' || queryTab === 'student-cohort') {
        setHodActiveTab('students');
      } else if (queryTab === 'timetable' || queryTab === 'schedule' || queryTab === 'department-timetable') {
        setHodActiveTab('timetable');
      } else if (queryTab === 'curriculum' || queryTab === 'syllabus' || queryTab === 'subjects') {
        setHodActiveTab('syllabus');
      } else if (queryTab === 'alerts' || queryTab === 'academic-alerts' || queryTab === 'insights') {
        setHodActiveTab('alerts');
      } else {
        setHodActiveTab(queryTab);
      }
    }
  }, [queryTab]);

  const isFacultyRosterActive = hodActiveTab === 'faculty' || hodActiveTab === 'roster';
  const isStudentCohortActive = hodActiveTab === 'students' || hodActiveTab === 'cohort' || hodActiveTab === 'student-cohort';
  const isTimetableActive = hodActiveTab === 'timetable' || hodActiveTab === 'schedule' || hodActiveTab === 'department-timetable';
  const isCurriculumActive = hodActiveTab === 'syllabus' || hodActiveTab === 'curriculum' || hodActiveTab === 'subjects';
  const isAlertsActive = hodActiveTab === 'alerts' || hodActiveTab === 'academic-alerts' || hodActiveTab === 'insights';

  const querySearch = searchParams.get('q');
  useEffect(() => {
    if (querySearch !== null && querySearch !== undefined) {
      setFacultySearch(querySearch);
      setStudentSearch(querySearch);
      setTimetableSearch(querySearch);
      setSubjectSearch(querySearch);
      setPerformanceSearch(querySearch);
      setAlertsSearch(querySearch);
    }
  }, [querySearch]);

  const handleTabChange = (tab) => {
    let canonicalTab = tab;
    if (tab === 'roster') canonicalTab = 'faculty';
    if (tab === 'cohort' || tab === 'student-cohort') canonicalTab = 'students';
    if (tab === 'schedule' || tab === 'department-timetable') canonicalTab = 'timetable';
    if (tab === 'curriculum' || tab === 'subjects') canonicalTab = 'syllabus';
    if (tab === 'alerts' || tab === 'academic-alerts' || tab === 'insights') canonicalTab = 'alerts';
    setHodActiveTab(canonicalTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const handleRefreshFaculty = async () => {
    setIsRefreshingFaculty(true);
    setFacultyFetchError(null);
    try {
      const [facRes, timeRes] = await Promise.all([
        api.getFaculty(),
        api.getTimetable()
      ]);
      if (facRes?.data) setFacultyList(facRes.data);
      if (timeRes?.data) setTimetableSlots(timeRes.data);
      addToast({
        type: 'success',
        title: 'Faculty Roster Refreshed',
        message: 'Live department faculty records and workload reloaded.'
      });
    } catch (err) {
      const msg = err.message || 'Failed to refresh faculty records';
      setFacultyFetchError(msg);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: msg
      });
    } finally {
      setIsRefreshingFaculty(false);
    }
  };

  const handleRefreshStudents = async () => {
    setIsRefreshingStudents(true);
    setStudentFetchError(null);
    try {
      const studRes = await api.getStudents({ limit: 500 });
      if (studRes?.data) setStudentList(studRes.data);
      addToast({
        type: 'success',
        title: 'Student Cohort Refreshed',
        message: 'Live department student cohort reloaded from database.'
      });
    } catch (err) {
      const msg = err.message || 'Failed to refresh student cohort';
      setStudentFetchError(msg);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: msg
      });
    } finally {
      setIsRefreshingStudents(false);
    }
  };

  const handleRefreshTimetable = async () => {
    setIsRefreshingTimetable(true);
    setTimetableFetchError(null);
    try {
      const timeRes = await api.getTimetable();
      if (timeRes?.data) setTimetableSlots(timeRes.data);
      addToast({
        type: 'success',
        title: 'Timetable Refreshed',
        message: 'Live department schedule and period slots reloaded.'
      });
    } catch (err) {
      const msg = err.message || 'Failed to refresh timetable schedule';
      setTimetableFetchError(msg);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: msg
      });
    } finally {
      setIsRefreshingTimetable(false);
    }
  };

  const handleRefreshCurriculum = async () => {
    setIsRefreshingCurriculum(true);
    setCurriculumFetchError(null);
    try {
      const subRes = await api.getSubjects();
      if (subRes?.data) setSubjects(subRes.data);
      addToast({
        type: 'success',
        title: 'Curriculum Refreshed',
        message: 'Live department curriculum courses and syllabus reloaded.'
      });
    } catch (err) {
      const msg = err.message || 'Failed to refresh curriculum subjects';
      setCurriculumFetchError(msg);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: msg
      });
    } finally {
      setIsRefreshingCurriculum(false);
    }
  };

  const handleRefreshAlerts = async () => {
    setIsRefreshingAlerts(true);
    setAlertsFetchError(null);
    try {
      await loadData();
      addToast({
        type: 'success',
        title: 'Alerts Refreshed',
        message: 'Live academic compliance records and department alerts reloaded.'
      });
    } catch (err) {
      const msg = err.message || 'Failed to reload academic alerts';
      setAlertsFetchError(msg);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        message: msg
      });
    } finally {
      setIsRefreshingAlerts(false);
    }
  };

  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAssignHodOpen, setIsAssignHodOpen] = useState(false);
  const [isCreateHodOpen, setIsCreateHodOpen] = useState(false);
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedHodUser, setSelectedHodUser] = useState(null);
  const [confirmToggleHod, setConfirmToggleHod] = useState(null);

  // Forms
  const [assignForm, setAssignForm] = useState({ hodUserId: '' });
  const [createHodForm, setCreateHodForm] = useState({
    name: '',
    email: '',
    password: '',
    department: 'Computer Science & Engineering'
  });
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        deptRes,
        usersRes,
        subjRes,
        timeRes,
        facRes,
        studRes,
        auditRes,
        examRes,
        noticeRes,
        resultsRes,
        attRecordsRes,
        feeRes
      ] = await Promise.all([
        api.getDepartmentSummaries().catch(() => ({ data: [] })),
        api.getUsers({ role: ROLES.HOD, limit: 50 }).catch(() => ({ data: [] })),
        api.getSubjects().catch(() => ({ data: [] })),
        api.getTimetable().catch(() => ({ data: [] })),
        api.getFaculty().catch(() => ({ data: [] })),
        api.getStudents({ limit: 500 }).catch(() => ({ data: [] })),
        api.getAuditLogs({ limit: 12 }).catch(() => ({ data: [] })),
        api.getExams().catch(() => ({ data: [] })),
        api.getNotices().catch(() => ({ data: [] })),
        api.getResults().catch(() => ({ data: [] })),
        api.getAttendance().catch(() => ({ data: [] })),
        api.getFeeStructures().catch(() => ({ data: [] }))
      ]);

      const deptData = deptRes?.data || [];
      if (deptRes?.data) setDepartments(deptData);
      if (usersRes?.data) setHodUsers(usersRes.data);
      if (subjRes?.data) setSubjects(subjRes.data);
      if (timeRes?.data) setTimetableSlots(timeRes.data);
      if (facRes?.data) setFacultyList(facRes.data);
      if (studRes?.data) setStudentList(studRes.data);
      if (resultsRes?.data) setResultsList(resultsRes.data);
      if (attRecordsRes?.data) setAttendanceRecords(attRecordsRes.data);
      if (examRes?.data) setAllExams(examRes.data);
      if (noticeRes?.data) setAllNotices(noticeRes.data);
      if (feeRes?.data) setFeeStructures(feeRes.data);

      if (auditRes?.data) {
        setRecentActivities(auditRes.data);
      }

      const currentDept = deptData.find(
        (d) =>
          (d.hod?._id && (d.hod._id === user?._id || d.hod._id === user?.id)) ||
          (d.hod?.id && (d.hod.id === user?._id || d.hod.id === user?.id)) ||
          (d.hod?.email && d.hod.email === user?.email) ||
          (d._id && user?.department && String(d._id) === String(user.department)) ||
          (d.id && user?.department && String(d.id) === String(user.department)) ||
          (d.name && user?.department && d.name.toLowerCase() === user.department.toLowerCase()) ||
          (d.code && user?.department && d.code.toLowerCase() === user.department.toLowerCase())
      );

      if (currentDept) {
        const attRes = await api.getAttendanceSummary({ department: currentDept.id || currentDept._id }).catch(() => null);
        if (attRes?.data) {
          setAttendanceSummary(attRes.data);
        }
      }

      // Parse upcoming examinations & notices
      const rawEvents = [];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const examList = examRes?.data || [];
      examList.forEach((exam) => {
        const examEnd = new Date(exam.endDate || exam.startDate);
        if (examEnd >= now) {
          rawEvents.push({
            id: `exam-${exam._id || exam.id}`,
            title: exam.name,
            subtitle: `${exam.examType} • Sem ${exam.semester} • ${exam.venue || 'Main Exam Hall'}`,
            date: new Date(exam.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
            rawDate: new Date(exam.startDate),
            icon: Award,
            color: 'text-blue-600 bg-blue-50',
            type: 'Exam'
          });
        }
      });

      const noticeList = noticeRes?.data || [];
      noticeList.forEach((notice) => {
        const noticeDate = new Date(notice.publicationDate || notice.createdAt);
        rawEvents.push({
          id: `notice-${notice._id || notice.id}`,
          title: notice.title,
          subtitle: `${notice.category || 'General'} Circular`,
          date: noticeDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
          rawDate: noticeDate,
          icon: BookOpen,
          color: notice.priority === 'urgent' ? 'text-rose-600 bg-rose-50' : 'text-amber-600 bg-amber-50',
          type: 'Notice'
        });
      });

      rawEvents.sort((a, b) => a.rawDate - b.rawDate);
      setUpcomingEvents(rawEvents.slice(0, 5));
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error loading HOD workspace',
        message: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast, user]);

  const handlePublishNoticeAction = async (noticeId) => {
    setIsPublishingNotice(true);
    try {
      await api.publishNotice(noticeId);
      addToast({
        type: 'success',
        title: 'Circular Published',
        message: 'The department notice has been successfully published.'
      });
      loadData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Publish Failed',
        message: err.message || 'Failed to publish notice.'
      });
    } finally {
      setIsPublishingNotice(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Assign HOD Modal
  const handleOpenAssign = (dept) => {
    setSelectedDept(dept);
    setAssignForm({ hodUserId: dept.hod?._id || dept.hod?.id || '' });
    setFormError('');
    setIsAssignHodOpen(true);
  };

  // Submit HOD Assignment to Department (with backend conflict prevention)
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDept) return;
    setFormError('');

    setIsSubmitting(true);
    try {
      await api.updateDepartment(selectedDept.id || selectedDept._id, {
        hod: assignForm.hodUserId || null
      });

      addToast({
        type: 'success',
        title: 'HOD Assigned',
        message: `Department ${selectedDept.name} leadership updated.`
      });
      setIsAssignHodOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to update department HOD.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create new HOD User Account
  const handleCreateHodSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!createHodForm.name || !createHodForm.email || !createHodForm.password) {
      setFormError('Please fill in all required fields.');
      return;
    }
    if (createHodForm.password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createUser({
        ...createHodForm,
        role: ROLES.HOD,
        status: USER_STATUS.ACTIVE
      });

      addToast({
        type: 'success',
        title: 'HOD Account Created',
        message: `Created account for ${createHodForm.email}`
      });
      setIsCreateHodOpen(false);
      setCreateHodForm({ name: '', email: '', password: '', department: 'Computer Science & Engineering' });
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to create HOD account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset HOD Password
  const handleResetPassSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHodUser) return;
    if (!newPasswordVal || newPasswordVal.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.resetUserPassword(selectedHodUser._id || selectedHodUser.id, newPasswordVal);
      addToast({
        type: 'success',
        title: 'Password Reset',
        message: `Temporary password assigned to ${selectedHodUser.email}`
      });
      setIsResetPassOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle HOD Status
  const handleConfirmToggleHod = async () => {
    if (!confirmToggleHod) return;
    const targetId = confirmToggleHod._id || confirmToggleHod.id;
    const newStatus = confirmToggleHod.status === USER_STATUS.ACTIVE ? USER_STATUS.DISABLED : USER_STATUS.ACTIVE;

    setIsSubmitting(true);
    try {
      await api.updateUserStatus(targetId, newStatus);
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: `${confirmToggleHod.email} is now ${newStatus}.`
      });
      setConfirmToggleHod(null);
      loadData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Status Update Failed',
        message: err.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vacant departments count
  const unassignedDepts = departments.filter((d) => !d.hasHod);

  // Departments Table Columns
  const deptColumns = [
    {
      header: 'Department & Code',
      cell: (row) => (
        <div>
          <span className="font-semibold text-navy-950 text-sm block">{row.name}</span>
          <span className="text-xs text-navy-500 font-mono">Code: {row.code}</span>
        </div>
      )
    },
    {
      header: 'Assigned Head (HOD)',
      cell: (row) => (
        row.hasHod ? (
          <div>
            <span className="text-xs font-semibold text-navy-900 block">{row.hod.name}</span>
            <span className="text-[11px] text-navy-500 font-mono">{row.hod.email}</span>
          </div>
        ) : (
          <Badge variant="danger" size="xs">
            Vacant (No HOD Assigned)
          </Badge>
        )
      )
    },
    {
      header: 'Enrolled Students',
      cell: (row) => (
        <span className="text-xs font-bold text-navy-900">
          {row.studentCount} / {row.intakeCapacity}
        </span>
      )
    },
    {
      header: 'Faculty Allocated',
      cell: (row) => (
        <span className="text-xs text-navy-700">
          {row.facultyCount} Members
        </span>
      )
    },
    {
      header: 'Curriculum Subjects',
      cell: (row) => (
        <span className="text-xs text-navy-700">
          {row.subjectCount} Courses
        </span>
      )
    },
    {
      header: 'Actions',
      cellClassName: 'text-right',
      cell: (row) => (
        <Button
          variant="secondary"
          size="xs"
          onClick={() => handleOpenAssign(row)}
          icon={Edit2}
        >
          {row.hasHod ? 'Reassign HOD' : 'Assign HOD'}
        </Button>
      )
    }
  ];

  // HOD Directory Table Columns
  const hodColumns = [
    {
      header: 'HOD Officer',
      cell: (row) => (
        <div>
          <span className="font-semibold text-navy-950 text-sm block">{row.name}</span>
          <span className="text-xs text-navy-500 font-mono flex items-center mt-0.5">
            <Mail className="w-3 h-3 mr-1 text-navy-400" />
            {row.email}
          </span>
        </div>
      )
    },
    {
      header: 'Department Assignment',
      cell: (row) => (
        <span className="text-xs text-navy-800 font-medium">{row.department || '—'}</span>
      )
    },
    {
      header: 'Status',
      cell: (row) => {
        const isActive = row.status === USER_STATUS.ACTIVE;
        return (
          <span className="inline-flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className={`text-xs font-semibold capitalize ${isActive ? 'text-emerald-700' : 'text-rose-700'}`}>
              {row.status}
            </span>
          </span>
        );
      }
    },
    {
      header: 'Last Login',
      cell: (row) => (
        <span className="text-xs text-navy-500 font-mono">
          {row.lastLogin ? new Date(row.lastLogin).toLocaleDateString() : 'Never'}
        </span>
      )
    },
    {
      header: 'Actions',
      cellClassName: 'text-right',
      cell: (row) => {
        const isActive = row.status === USER_STATUS.ACTIVE;
        return (
          <div className="flex items-center justify-end space-x-1.5">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                setSelectedHodUser(row);
                setNewPasswordVal('');
                setFormError('');
                setIsResetPassOpen(true);
              }}
              icon={Key}
              title="Reset Password"
            >
              Reset Pass
            </Button>
            <Button
              variant={isActive ? 'danger' : 'secondary'}
              size="xs"
              onClick={() => setConfirmToggleHod(row)}
              icon={isActive ? UserX : UserCheck}
            >
              {isActive ? 'Disable' : 'Activate'}
            </Button>
          </div>
        );
      }
    }
  ];

  const isHodRole = user?.role === ROLES.HOD;
  const myDept = departments.find(
    (d) =>
      (d.hod?._id && (d.hod._id === user?._id || d.hod._id === user?.id)) ||
      (d.hod?.id && (d.hod.id === user?._id || d.hod.id === user?.id)) ||
      (d.hod?.email && d.hod.email === user?.email) ||
      (d._id && user?.department && String(d._id) === String(user.department)) ||
      (d.id && user?.department && String(d.id) === String(user.department)) ||
      (d.name && user?.department && d.name.toLowerCase() === user.department.toLowerCase()) ||
      (d.code && user?.department && d.code.toLowerCase() === user.department.toLowerCase())
  );

  const isEntityInDept = (entityDept, targetDept) => {
    if (!entityDept || !targetDept) return false;
    const entityDeptId = entityDept._id || (typeof entityDept === 'string' ? entityDept : entityDept.id);
    const targetDeptId = targetDept.id || targetDept._id;
    if (entityDeptId && targetDeptId && String(entityDeptId) === String(targetDeptId)) return true;
    if (entityDept.name && targetDept.name && entityDept.name.toLowerCase() === targetDept.name.toLowerCase()) return true;
    if (entityDept.code && targetDept.code && entityDept.code.toLowerCase() === targetDept.code.toLowerCase()) return true;
    return false;
  };

  const deptFaculty = myDept
    ? facultyList.filter((f) => isEntityInDept(f.department, myDept))
    : (user?.role === ROLES.HOD ? facultyList : []);

  const deptStudents = myDept
    ? studentList.filter((s) => isEntityInDept(s.department, myDept))
    : (user?.role === ROLES.HOD ? studentList : []);

  const deptSubjects = myDept
    ? subjects.filter((s) => isEntityInDept(s.department, myDept) || (!s.department && isEntityInDept(s.course?.department, myDept)))
    : [];

  const deptTimetable = myDept
    ? timetableSlots.filter((t) => isEntityInDept(t.department, myDept))
    : [];

  // ==========================================
  // VIEW 1: AUTHENTICATED HOD ROLE PORTAL
  // ==========================================
  // Real Semester-wise Student Strength aggregated from database
  const semesterStrengthData = [1, 2, 3, 4, 5, 6, 7, 8].map((sem) => ({
    label: `Sem ${sem}`,
    value: deptStudents.filter((s) => Number(s.currentSemester) === sem).length,
    color: 'bg-sky-400'
  }));

  // Real Faculty Workload Breakdown categorized by Theory, Lab, Project, Other
  const workloadCounts = {
    Theory: 0,
    Lab: 0,
    Project: 0,
    Other: 0
  };

  if (deptTimetable.length > 0) {
    deptTimetable.forEach((slot) => {
      const sub = slot.subject;
      if (!sub) {
        workloadCounts.Other += 1;
      } else if (sub.isLab) {
        workloadCounts.Lab += 1;
      } else if (sub.name && sub.name.toLowerCase().includes('project')) {
        workloadCounts.Project += 1;
      } else {
        workloadCounts.Theory += 1;
      }
    });
  } else if (deptSubjects.length > 0) {
    deptSubjects.forEach((sub) => {
      if (sub.isLab) {
        workloadCounts.Lab += 1;
      } else if (sub.name && sub.name.toLowerCase().includes('project')) {
        workloadCounts.Project += 1;
      } else {
        workloadCounts.Theory += 1;
      }
    });
  }

  const totalWorkload = workloadCounts.Theory + workloadCounts.Lab + workloadCounts.Project + workloadCounts.Other;

  const facultyWorkloadDonut = [
    { label: 'Theory', value: workloadCounts.Theory, color: '#f59e0b' },
    { label: 'Lab', value: workloadCounts.Lab, color: '#10b981' },
    { label: 'Project', value: workloadCounts.Project, color: '#3b82f6' },
    { label: 'Other', value: workloadCounts.Other, color: '#8b5cf6' }
  ];

  // Assigned subjects and timetable slots correlation for faculty
  const getFacultyAssignedSubjects = useCallback((fac) => {
    if (!fac) return [];
    const facId = fac._id || fac.id;
    const facUserId = fac.user?._id || fac.user?.id;
    const assigned = new Map();
    deptTimetable.forEach((slot) => {
      const slotFacId = slot.faculty?._id || slot.faculty?.id || slot.faculty;
      const slotFacUserId = slot.faculty?.user?._id || slot.faculty?.user?.id || slot.faculty?.user;
      if (
        (facId && String(slotFacId) === String(facId)) ||
        (facUserId && String(slotFacUserId) === String(facUserId))
      ) {
        if (slot.subject) {
          const subKey = slot.subject._id || slot.subject.id || slot.subject.code || slot.subject.name;
          assigned.set(subKey, {
            name: slot.subject.name || 'Subject',
            code: slot.subject.code || '',
            semester: slot.semester,
            section: slot.section
          });
        }
      }
    });
    return Array.from(assigned.values());
  }, [deptTimetable]);

  const getFacultyTimetableSlots = useCallback((fac) => {
    if (!fac) return [];
    const facId = fac._id || fac.id;
    const facUserId = fac.user?._id || fac.user?.id;
    return deptTimetable.filter((slot) => {
      const slotFacId = slot.faculty?._id || slot.faculty?.id || slot.faculty;
      const slotFacUserId = slot.faculty?.user?._id || slot.faculty?.user?.id || slot.faculty?.user;
      return (
        (facId && String(slotFacId) === String(facId)) ||
        (facUserId && String(slotFacUserId) === String(facUserId))
      );
    });
  }, [deptTimetable]);

  const getSubjectTimetableSlots = useCallback((sub) => {
    if (!sub) return [];
    const subId = sub._id || sub.id;
    const subCode = (sub.code || '').toUpperCase().trim();
    return deptTimetable.filter((slot) => {
      const slotSubId = slot.subject?._id || slot.subject?.id;
      const slotSubCode = (slot.subject?.code || '').toUpperCase().trim();
      return (subId && slotSubId && String(subId) === String(slotSubId)) || (subCode && slotSubCode === subCode);
    });
  }, [deptTimetable]);

  const getSubjectAssignedFaculty = useCallback((sub) => {
    const slots = getSubjectTimetableSlots(sub);
    const facultyMap = new Map();
    slots.forEach((s) => {
      const fac = s.faculty;
      if (fac) {
        const id = fac._id || fac.id;
        const name = fac.user?.name || fac.name;
        if (id && name) {
          facultyMap.set(String(id), {
            id: String(id),
            name,
            email: fac.user?.email || '',
            designation: fac.designation || 'Faculty Member',
            employeeId: fac.employeeId || ''
          });
        }
      }
    });
    return Array.from(facultyMap.values());
  }, [getSubjectTimetableSlots]);

  // Tab Filtering & Sorting Computations for Faculty Roster
  const filteredFaculty = deptFaculty
    .filter((fac) => {
      const name = fac.user?.name || '';
      const email = fac.user?.email || '';
      const empId = fac.employeeId || '';
      const spec = fac.specialization || '';
      const q = facultySearch.trim().toLowerCase();
      const qMatch =
        !q ||
        [name, email, empId, spec].some((field) =>
          field.toLowerCase().includes(q)
        );
      const desigMatch =
        !facultyDesignation ||
        facultyDesignation === 'All' ||
        fac.designation === facultyDesignation;
      const status = (fac.user?.status || 'active').toLowerCase();
      const statusMatch =
        !facultyStatusFilter ||
        facultyStatusFilter === 'All' ||
        status === facultyStatusFilter.toLowerCase();
      return qMatch && desigMatch && statusMatch;
    })
    .sort((a, b) => {
      if (facultySortBy === 'name-asc') {
        return (a.user?.name || '').localeCompare(b.user?.name || '');
      }
      if (facultySortBy === 'name-desc') {
        return (b.user?.name || '').localeCompare(a.user?.name || '');
      }
      if (facultySortBy === 'id-asc') {
        return (a.employeeId || '').localeCompare(b.employeeId || '');
      }
      if (facultySortBy === 'id-desc') {
        return (b.employeeId || '').localeCompare(a.employeeId || '');
      }
      if (facultySortBy === 'desig-asc') {
        return (a.designation || '').localeCompare(b.designation || '');
      }
      if (facultySortBy === 'desig-desc') {
        return (b.designation || '').localeCompare(a.designation || '');
      }
      return 0;
    });

  // Accurate Summary Metrics Calculated from Authorized Department Records
  const totalFacultyCount = deptFaculty.length;
  const activeFacultyCount = deptFaculty.filter(
    (f) => (f.user?.status || 'active').toLowerCase() === 'active'
  ).length;
  const profCount = deptFaculty.filter(
    (f) => /professor$/i.test(f.designation || '') && !/associate|assistant/i.test(f.designation || '')
  ).length;
  const assocProfCount = deptFaculty.filter(
    (f) => /associate/i.test(f.designation || '')
  ).length;
  const asstProfCount = deptFaculty.filter(
    (f) => /assistant/i.test(f.designation || '')
  ).length;
  const facultyWithAssignedSubjectsCount = deptFaculty.filter(
    (f) => getFacultyAssignedSubjects(f).length > 0
  ).length;

  // Accurate Student Summary Metrics Calculated from Authorized Department Records
  const totalStudentsCount = deptStudents.length;
  const activeStudentsCount = deptStudents.filter(
    (s) =>
      (s.admissionStatus || 'enrolled').toLowerCase() === 'enrolled' ||
      (s.user?.status || 'active').toLowerCase() === 'active'
  ).length;

  const distinctBatches = Array.from(
    new Set(deptStudents.map((s) => s.batchYear).filter(Boolean))
  ).sort();

  const distinctSemesters = Array.from(
    new Set(deptStudents.map((s) => s.currentSemester).filter(Boolean))
  ).sort((a, b) => a - b);

  const filteredStudents = deptStudents
    .filter((stud) => {
      const name = stud.user?.name || '';
      const email = stud.user?.email || '';
      const roll = stud.rollNumber || '';
      const enr = stud.enrollmentNumber || '';
      const course = stud.course?.name || stud.course?.code || '';
      const q = studentSearch.trim().toLowerCase();
      const qMatch =
        !q ||
        [name, email, roll, enr, course].some((field) =>
          field.toLowerCase().includes(q)
        );
      const semMatch =
        !studentSemester ||
        studentSemester === 'All' ||
        String(stud.currentSemester) === String(studentSemester);
      const batchMatch =
        !studentBatchFilter ||
        studentBatchFilter === 'All' ||
        String(stud.batchYear) === String(studentBatchFilter);
      const status = (stud.admissionStatus || stud.user?.status || 'enrolled').toLowerCase();
      const statusMatch =
        !studentStatusFilter ||
        studentStatusFilter === 'All' ||
        status === studentStatusFilter.toLowerCase() ||
        (studentStatusFilter === 'Active' && stud.user?.status === USER_STATUS.ACTIVE) ||
        (studentStatusFilter === 'Disabled' && stud.user?.status === USER_STATUS.DISABLED);
      return qMatch && semMatch && batchMatch && statusMatch;
    })
    .sort((a, b) => {
      if (studentSortBy === 'roll-asc') {
        return (a.rollNumber || '').localeCompare(b.rollNumber || '');
      }
      if (studentSortBy === 'roll-desc') {
        return (b.rollNumber || '').localeCompare(a.rollNumber || '');
      }
      if (studentSortBy === 'name-asc') {
        return (a.user?.name || '').localeCompare(b.user?.name || '');
      }
      if (studentSortBy === 'name-desc') {
        return (b.user?.name || '').localeCompare(a.user?.name || '');
      }
      if (studentSortBy === 'sem-asc') {
        return (Number(a.currentSemester) || 0) - (Number(b.currentSemester) || 0);
      }
      if (studentSortBy === 'sem-desc') {
        return (Number(b.currentSemester) || 0) - (Number(a.currentSemester) || 0);
      }
      return 0;
    });

  const distinctTimetableSections = useMemo(() => {
    const set = new Set();
    deptTimetable.forEach((s) => {
      if (s.section) set.add(String(s.section).toUpperCase().trim());
    });
    set.add('A');
    set.add('B');
    return Array.from(set).sort();
  }, [deptTimetable]);

  const distinctTimetableFaculty = useMemo(() => {
    const map = new Map();
    deptFaculty.forEach((f) => {
      const id = f._id || f.id;
      const name = f.user?.name || f.name || 'Faculty Member';
      if (id) map.set(String(id), { id: String(id), name });
    });
    deptTimetable.forEach((s) => {
      const id = s.faculty?._id || s.faculty?.id;
      const name = s.faculty?.user?.name || s.faculty?.name;
      if (id && name) {
        map.set(String(id), { id: String(id), name });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [deptFaculty, deptTimetable]);

  const timetableConflicts = useMemo(() => {
    const conflicts = [];
    for (let i = 0; i < deptTimetable.length; i++) {
      for (let j = i + 1; j < deptTimetable.length; j++) {
        const a = deptTimetable[i];
        const b = deptTimetable[j];
        if (
          a.dayOfWeek?.toLowerCase() === b.dayOfWeek?.toLowerCase() &&
          Number(a.periodNumber) === Number(b.periodNumber)
        ) {
          // Check room clash
          if (
            a.roomNumber &&
            b.roomNumber &&
            a.roomNumber.trim().toLowerCase() === b.roomNumber.trim().toLowerCase()
          ) {
            conflicts.push({
              id: `room-${a._id || a.id}-${b._id || b.id}`,
              type: 'room',
              message: `Room conflict: '${a.roomNumber.trim()}' is double-booked for ${a.subject?.code || 'Slot 1'} and ${b.subject?.code || 'Slot 2'} on ${a.dayOfWeek} (Period ${a.periodNumber}).`
            });
          }
          // Check faculty clash
          const facA = a.faculty?._id || a.faculty?.id;
          const facB = b.faculty?._id || b.faculty?.id;
          if (facA && facB && String(facA) === String(facB)) {
            conflicts.push({
              id: `faculty-${a._id || a.id}-${b._id || b.id}`,
              type: 'faculty',
              message: `Faculty conflict: ${a.faculty?.user?.name || a.faculty?.name || 'Instructor'} is double-booked on ${a.dayOfWeek} (Period ${a.periodNumber}) for ${a.subject?.code || 'Slot 1'} and ${b.subject?.code || 'Slot 2'}.`
            });
          }
          // Check section clash
          if (
            String(a.semester) === String(b.semester) &&
            (a.section || '').toUpperCase() === (b.section || '').toUpperCase()
          ) {
            conflicts.push({
              id: `section-${a._id || a.id}-${b._id || b.id}`,
              type: 'section',
              message: `Section clash: Sem ${a.semester} Sec ${a.section || 'A'} has overlapping sessions on ${a.dayOfWeek} (Period ${a.periodNumber}).`
            });
          }
        }
      }
    }
    return conflicts;
  }, [deptTimetable]);

  const dayOrderMap = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };
  const filteredTimetable = useMemo(() => {
    return deptTimetable
      .filter((slot) => {
        // Day filter
        const dayMatch =
          !timetableDay ||
          timetableDay === 'All' ||
          slot.dayOfWeek?.toLowerCase() === timetableDay.toLowerCase();

        // Semester filter
        const semMatch =
          !timetableSemester ||
          timetableSemester === 'All' ||
          String(slot.semester) === String(timetableSemester);

        // Section filter
        const secMatch =
          !timetableSection ||
          timetableSection === 'All' ||
          (slot.section || '').toUpperCase() === timetableSection.toUpperCase();

        // Faculty filter
        const facId = slot.faculty?._id || slot.faculty?.id;
        const facMatch =
          !timetableFaculty ||
          timetableFaculty === 'All' ||
          (facId && String(facId) === String(timetableFaculty));

        // Type filter
        const isLab = !!slot.subject?.isLab;
        const typeMatch =
          !timetableType ||
          timetableType === 'All' ||
          (timetableType === 'lab' && isLab) ||
          (timetableType === 'theory' && !isLab);

        // Text Search
        let searchMatch = true;
        if (timetableSearch && timetableSearch.trim()) {
          const q = timetableSearch.trim().toLowerCase();
          const subName = (slot.subject?.name || '').toLowerCase();
          const subCode = (slot.subject?.code || '').toLowerCase();
          const room = (slot.roomNumber || '').toLowerCase();
          const facName = (slot.faculty?.user?.name || slot.faculty?.name || '').toLowerCase();
          const facEmail = (slot.faculty?.user?.email || '').toLowerCase();
          const empId = (slot.faculty?.employeeId || '').toLowerCase();
          const day = (slot.dayOfWeek || '').toLowerCase();
          searchMatch =
            subName.includes(q) ||
            subCode.includes(q) ||
            room.includes(q) ||
            facName.includes(q) ||
            facEmail.includes(q) ||
            empId.includes(q) ||
            day.includes(q);
        }

        return dayMatch && semMatch && secMatch && facMatch && typeMatch && searchMatch;
      })
      .sort((a, b) => {
        if (timetableSortBy === 'time-asc') {
          return (a.startTime || '').localeCompare(b.startTime || '');
        }
        if (timetableSortBy === 'subject-asc') {
          return (a.subject?.name || '').localeCompare(b.subject?.name || '');
        }
        if (timetableSortBy === 'faculty-asc') {
          const fA = a.faculty?.user?.name || a.faculty?.name || '';
          const fB = b.faculty?.user?.name || b.faculty?.name || '';
          return fA.localeCompare(fB);
        }
        const dayA = dayOrderMap[a.dayOfWeek?.toLowerCase()] || 99;
        const dayB = dayOrderMap[b.dayOfWeek?.toLowerCase()] || 99;
        if (dayA !== dayB) return dayA - dayB;
        return (Number(a.periodNumber) || 0) - (Number(b.periodNumber) || 0);
      });
  }, [
    deptTimetable,
    timetableDay,
    timetableSemester,
    timetableSection,
    timetableFaculty,
    timetableType,
    timetableSearch,
    timetableSortBy
  ]);

  const filteredSubjects = useMemo(() => {
    return deptSubjects
      .filter((sub) => {
        // Search filter
        let qMatch = true;
        if (subjectSearch && subjectSearch.trim()) {
          const q = subjectSearch.trim().toLowerCase();
          const name = (sub.name || '').toLowerCase();
          const code = (sub.code || '').toLowerCase();
          const courseName = (sub.course?.name || sub.course?.code || '').toLowerCase();
          const assignedFac = getSubjectAssignedFaculty(sub)
            .map((f) => f.name.toLowerCase())
            .join(' ');
          qMatch = name.includes(q) || code.includes(q) || courseName.includes(q) || assignedFac.includes(q);
        }

        // Semester filter
        const semMatch =
          !subjectSemester || subjectSemester === 'All' || String(sub.semester) === String(subjectSemester);

        // Subject Type filter (Theory / Lab / Project)
        const subType = sub.isLab ? 'Lab' : sub.name?.toLowerCase().includes('project') ? 'Project' : 'Theory';
        const typeMatch = !subjectType || subjectType === 'All' || subType.toLowerCase() === subjectType.toLowerCase();

        // Credits filter
        const creditMatch =
          !subjectCreditsFilter ||
          subjectCreditsFilter === 'All' ||
          String(sub.credits) === String(subjectCreditsFilter);

        // Syllabus Status filter
        const hasSyllabus = Boolean(sub.syllabusUrl);
        const statusMatch =
          !subjectStatusFilter ||
          subjectStatusFilter === 'All' ||
          (subjectStatusFilter === 'attached' && hasSyllabus) ||
          (subjectStatusFilter === 'core' && !hasSyllabus);

        return qMatch && semMatch && typeMatch && creditMatch && statusMatch;
      })
      .sort((a, b) => {
        if (subjectSortBy === 'code-asc') {
          return (a.code || '').localeCompare(b.code || '');
        }
        if (subjectSortBy === 'code-desc') {
          return (b.code || '').localeCompare(a.code || '');
        }
        if (subjectSortBy === 'name-asc') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (subjectSortBy === 'name-desc') {
          return (b.name || '').localeCompare(a.name || '');
        }
        if (subjectSortBy === 'sem-asc') {
          return (Number(a.semester) || 0) - (Number(b.semester) || 0);
        }
        if (subjectSortBy === 'sem-desc') {
          return (Number(b.semester) || 0) - (Number(a.semester) || 0);
        }
        if (subjectSortBy === 'credits-desc') {
          return (Number(b.credits) || 0) - (Number(a.credits) || 0);
        }
        if (subjectSortBy === 'credits-asc') {
          return (Number(a.credits) || 0) - (Number(b.credits) || 0);
        }
        return 0;
      });
  }, [
    deptSubjects,
    subjectSearch,
    subjectSemester,
    subjectType,
    subjectCreditsFilter,
    subjectStatusFilter,
    subjectSortBy,
    getSubjectAssignedFaculty
  ]);

  // Accurate Curriculum Summary Metrics Calculated from Authorized Department Records
  const totalCurriculumSubjects = deptSubjects.length;
  const theorySubjectsCount = deptSubjects.filter(
    (s) => !s.isLab && !s.name?.toLowerCase().includes('project')
  ).length;
  const labSubjectsCount = deptSubjects.filter((s) => Boolean(s.isLab)).length;
  const projectSubjectsCount = deptSubjects.filter(
    (s) => s.name?.toLowerCase().includes('project')
  ).length;
  const totalCreditsCount = deptSubjects.reduce(
    (acc, s) => acc + (Number(s.credits) || 0),
    0
  );
  const syllabusAttachedCount = deptSubjects.filter((s) => Boolean(s.syllabusUrl)).length;
  const facultyAllocatedCount = deptSubjects.filter(
    (s) => getSubjectAssignedFaculty(s).length > 0
  ).length;

  const distinctSubjectSemesters = useMemo(() => {
    const sems = new Set();
    deptSubjects.forEach((s) => {
      if (s.semester) sems.add(Number(s.semester));
    });
    return Array.from(sems).sort((a, b) => a - b);
  }, [deptSubjects]);

  const distinctSubjectCredits = useMemo(() => {
    const creds = new Set();
    deptSubjects.forEach((s) => {
      if (s.credits) creds.add(Number(s.credits));
    });
    return Array.from(creds).sort((a, b) => a - b);
  }, [deptSubjects]);

  // Feature A: Student Performance Insights & Attention Computations
  const atRiskStudents = [];
  deptStudents.forEach((stud) => {
    const studId = stud._id || stud.id;
    const studRoll = stud.rollNumber;

    // Check attendance records for this student
    const studAttRecords = attendanceRecords.filter(
      (att) =>
        (att.student?._id && att.student._id === studId) ||
        (att.student?.rollNumber && att.student.rollNumber === studRoll) ||
        att.student === studId
    );
    let attendancePct = null;
    let hasLowAttendance = false;
    if (studAttRecords.length > 0) {
      const presentCount = studAttRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
      attendancePct = Number(((presentCount / studAttRecords.length) * 100).toFixed(1));
      if (attendancePct < 75) {
        hasLowAttendance = true;
      }
    }

    // Check examination results for this student
    const studResults = resultsList.filter(
      (res) =>
        (res.student?._id && res.student._id === studId) ||
        (res.student?.rollNumber && res.student.rollNumber === studRoll) ||
        res.student === studId
    );
    const lowMarksResults = studResults.filter(
      (res) =>
        (res.internalMarks !== undefined && res.internalMarks < 16) ||
        res.status === 'failed' ||
        (res.totalMarks !== undefined && res.totalMarks < 40)
    );
    const hasLowMarks = lowMarksResults.length > 0;

    if (hasLowAttendance || hasLowMarks) {
      atRiskStudents.push({
        id: studId,
        student: stud,
        attendancePct,
        attRecordsCount: studAttRecords.length,
        hasLowAttendance,
        lowMarksResults,
        hasLowMarks,
        alertType: hasLowAttendance && hasLowMarks ? 'Both' : hasLowAttendance ? 'Attendance' : 'Academic',
        reason: [
          hasLowAttendance ? `Attendance at ${attendancePct}% (<75% min required)` : null,
          hasLowMarks
            ? `Underperforming in ${lowMarksResults.map((r) => r.subject?.code || r.subject?.name || 'Exam').join(', ')}`
            : null
        ]
          .filter(Boolean)
          .join(' • ')
      });
    }
  });

  const studentsRequiringAttentionCount = atRiskStudents.length;

  const filteredAtRisk = atRiskStudents.filter((item) => {
    const name = item.student?.user?.name || '';
    const roll = item.student?.rollNumber || '';
    const qMatch = !performanceSearch || [name, roll].some((f) => f.toLowerCase().includes(performanceSearch.toLowerCase()));
    const typeMatch =
      performanceTypeFilter === 'All' ||
      (performanceTypeFilter === 'Attendance' && item.hasLowAttendance) ||
      (performanceTypeFilter === 'Academic' && item.hasLowMarks);
    const semMatch =
      performanceSemester === 'All' || String(item.student?.currentSemester) === String(performanceSemester);
    return qMatch && typeMatch && semMatch;
  });

  // Feature B: HOD Action Center Computations
  const actionItems = [];

  // 1. Unrecorded attendance for department subjects
  deptSubjects.forEach((sub) => {
    const subId = sub._id || sub.id;
    const subRecords = attendanceRecords.filter(
      (a) => a.subject?._id === subId || a.subject === subId || a.subject?.code === sub.code
    );
    if (subRecords.length === 0) {
      actionItems.push({
        id: `att-sub-${subId}`,
        type: 'attendance',
        urgency: 'Action Needed',
        badgeVariant: 'amber',
        title: `Unrecorded Attendance: ${sub.name}`,
        description: `Code: ${sub.code} • Semester ${sub.semester} • 0 sessions registered`,
        actionLabel: 'Open Register',
        onClick: () => navigate('/attendance')
      });
    }
  });

  // 2. Pending Internal Marks Entry for scheduled/ongoing exams
  allExams.forEach((exam) => {
    const examId = exam._id || exam.id;
    const examResults = resultsList.filter(
      (r) => r.examination?._id === examId || r.examination === examId
    );
    if (examResults.length === 0 && (exam.status === 'scheduled' || exam.status === 'ongoing')) {
      actionItems.push({
        id: `exam-res-${examId}`,
        type: 'results',
        urgency: exam.status === 'ongoing' ? 'Urgent' : 'Pending',
        badgeVariant: exam.status === 'ongoing' ? 'danger' : 'navy',
        title: `Pending Marks: ${exam.name}`,
        description: `${exam.examType} • Semester ${exam.semester} • Results pending submission`,
        actionLabel: 'Enter Marks',
        onClick: () => navigate('/results')
      });
    }
  });

  // 3. Draft Notices awaiting publication
  allNotices.forEach((notice) => {
    if (notice.status === 'draft') {
      actionItems.push({
        id: `notice-draft-${notice._id || notice.id}`,
        type: 'notice',
        urgency: 'Pending Review',
        badgeVariant: 'teal',
        title: `Draft Circular: ${notice.title}`,
        description: `Category: ${notice.category} • Created ${formatTimeAgo(notice.createdAt)}`,
        actionLabel: isPublishingNotice ? 'Publishing...' : 'Publish Now',
        isLoading: isPublishingNotice,
        onClick: () => handlePublishNoticeAction(notice._id || notice.id),
        secondaryActionLabel: 'Edit',
        onSecondaryClick: () => navigate('/notices')
      });
    }
  });

  // 4. Timetable slots needing instructor/room allocation
  deptTimetable.forEach((slot, idx) => {
    if (!slot.faculty || !slot.roomNumber) {
      actionItems.push({
        id: `slot-unassigned-${slot._id || slot.id || idx}`,
        type: 'timetable',
        urgency: 'Incomplete',
        badgeVariant: 'amber',
        title: `Slot Coverage: Period ${slot.periodNumber} (${slot.dayOfWeek?.toUpperCase()})`,
        description: `${slot.subject?.name || 'Lecture'} • Requires room or instructor allocation`,
        actionLabel: 'Review Timetable',
        onClick: () => handleTabChange('timetable')
      });
    }
  });

  // Feature C: Academic Alerts & Deadline Tracking
  const seenDeadlines = new Set();
  const academicDeadlines = [];
  const nowDate = new Date();
  nowDate.setHours(0, 0, 0, 0);

  allExams.forEach((exam) => {
    const examStart = new Date(exam.startDate);
    const examEnd = new Date(exam.endDate || exam.startDate);
    const isRelevant =
      (examEnd >= nowDate || exam.status === 'scheduled' || exam.status === 'ongoing') &&
      exam.status !== 'completed' &&
      exam.status !== 'cancelled';
    if (isRelevant) {
      const daysLeft = Math.ceil((examStart - nowDate) / (1000 * 60 * 60 * 24));
      const id = `exam-dl-${exam._id || exam.id}`;
      if (!seenDeadlines.has(id)) {
        seenDeadlines.add(id);
        academicDeadlines.push({
          id,
          type: 'exam',
          title: exam.name,
          subtitle: `${exam.examType} • Sem ${exam.semester} • ${exam.venue || 'Exam Hall'}`,
          rawDate: examStart,
          dateFormatted: examStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          countdown:
            exam.status === 'ongoing'
              ? 'Ongoing Now'
              : daysLeft === 0
              ? 'Today'
              : daysLeft === 1
              ? 'Tomorrow'
              : daysLeft < 0
              ? 'In Progress'
              : `In ${daysLeft} days`,
          isUrgent: daysLeft <= 3 || exam.status === 'ongoing',
          statusBadge: exam.status === 'ongoing' ? 'Ongoing' : 'Scheduled',
          link: '/examinations'
        });
      }
    }
  });

  allNotices.forEach((notice) => {
    if (notice.status === 'published') {
      const pDate = new Date(notice.publicationDate || notice.createdAt);
      const isUrgent = notice.priority === 'urgent';
      const id = `notice-dl-${notice._id || notice.id}`;
      if (!seenDeadlines.has(id)) {
        seenDeadlines.add(id);
        academicDeadlines.push({
          id,
          type: 'notice',
          title: `${isUrgent ? 'Urgent Circular: ' : ''}${notice.title}`,
          subtitle: `${notice.category || 'General'} Circular • ${formatTimeAgo(pDate)}`,
          rawDate: pDate,
          dateFormatted: pDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          countdown: isUrgent ? 'Urgent Circular' : 'Published Circular',
          isUrgent,
          statusBadge: isUrgent ? 'Urgent' : 'Notice',
          link: '/notices'
        });
      }
    }
  });

  feeStructures.forEach((fee) => {
    if (fee.dueDate) {
      const due = new Date(fee.dueDate);
      if (due >= nowDate) {
        const daysLeft = Math.ceil((due - nowDate) / (1000 * 60 * 60 * 24));
        const id = `fee-dl-${fee._id || fee.id}`;
        if (!seenDeadlines.has(id)) {
          seenDeadlines.add(id);
          academicDeadlines.push({
            id,
            type: 'fee',
            title: `Fee Schedule: ${fee.title}`,
            subtitle: `Academic Year ${fee.academicYear} • Sem ${fee.semester} (₹${(fee.totalAmount || 0).toLocaleString()})`,
            rawDate: due,
            dateFormatted: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            countdown: daysLeft === 0 ? 'Due Today' : `Due in ${daysLeft}d`,
            isUrgent: daysLeft <= 7,
            statusBadge: 'Fee Deadline',
            link: '/reports'
          });
        }
      }
    }
  });

  academicDeadlines.sort((a, b) => a.rawDate - b.rawDate);

  const filteredDeadlines = academicDeadlines.filter((item) => {
    if (deadlinesFilter === 'Exams') return item.type === 'exam';
    if (deadlinesFilter === 'Circulars') return item.type === 'notice';
    return true;
  });

  // Feature E: Export CSV Handlers
  const handleExportFaculty = () => {
    exportToCsv(
      `${myDept?.code || 'DEPT'}_Faculty_Roster`,
      filteredFaculty,
      [
        { header: 'Employee ID', accessor: (r) => r.employeeId || '' },
        { header: 'Full Name', accessor: (r) => r.user?.name || '' },
        { header: 'Email Address', accessor: (r) => r.user?.email || '' },
        { header: 'Designation', accessor: (r) => r.designation || '' },
        { header: 'Specialization', accessor: (r) => r.specialization || '' },
        { header: 'Qualification', accessor: (r) => r.qualification || '' },
        {
          header: 'Assigned Subjects',
          accessor: (r) =>
            getFacultyAssignedSubjects(r)
              .map((s) => `${s.code ? s.code + ' - ' : ''}${s.name}`)
              .join('; ') || 'None'
        },
        { header: 'Status', accessor: (r) => r.user?.status || 'Active' }
      ]
    );
    addToast({ type: 'success', title: 'Export Generated', message: 'Faculty roster downloaded as CSV.' });
  };

  const handleExportStudents = () => {
    exportToCsv(
      `${myDept?.code || 'DEPT'}_Enrolled_Students`,
      filteredStudents,
      [
        { header: 'Roll Number', accessor: (r) => r.rollNumber || '' },
        { header: 'Enrollment Number', accessor: (r) => r.enrollmentNumber || '' },
        { header: 'Student Name', accessor: (r) => r.user?.name || '' },
        { header: 'Email Address', accessor: (r) => r.user?.email || '' },
        { header: 'Department', accessor: (r) => r.department?.name || myDept?.name || '' },
        { header: 'Program / Course', accessor: (r) => r.course?.name || r.course?.code || 'B.Tech' },
        { header: 'Current Semester', accessor: (r) => r.currentSemester || '' },
        { header: 'Batch Year', accessor: (r) => r.batchYear || '' },
        { header: 'Admission Status', accessor: (r) => r.admissionStatus || 'enrolled' },
        { header: 'Account Status', accessor: (r) => r.user?.status || 'Active' }
      ]
    );
    addToast({ type: 'success', title: 'Export Generated', message: 'Enrolled students cohort downloaded as CSV.' });
  };

  const handleExportTimetable = () => {
    exportToCsv(
      `${myDept?.code || 'DEPT'}_Master_Timetable`,
      filteredTimetable,
      [
        { header: 'Day of Week', accessor: (r) => (r.dayOfWeek || '').toUpperCase() },
        { header: 'Period Number', accessor: (r) => r.periodNumber || '' },
        { header: 'Start Time', accessor: (r) => r.startTime || '' },
        { header: 'End Time', accessor: (r) => r.endTime || '' },
        { header: 'Subject Code', accessor: (r) => r.subject?.code || '' },
        { header: 'Subject Name', accessor: (r) => r.subject?.name || '' },
        { header: 'Session Type', accessor: (r) => (r.subject?.isLab ? 'Lab / Practical' : 'Theory / Lecture') },
        { header: 'Credits', accessor: (r) => r.subject?.credits || '' },
        { header: 'Semester', accessor: (r) => r.semester || '' },
        { header: 'Section', accessor: (r) => r.section || 'A' },
        { header: 'Room / Venue', accessor: (r) => r.roomNumber || 'TBD' },
        { header: 'Assigned Faculty', accessor: (r) => r.faculty?.user?.name || r.faculty?.name || 'Unassigned' },
        { header: 'Faculty Email', accessor: (r) => r.faculty?.user?.email || '' },
        { header: 'Designation', accessor: (r) => r.faculty?.designation || '' }
      ]
    );
    addToast({ type: 'success', title: 'Export Generated', message: 'Department timetable downloaded as CSV.' });
  };

  const handleExportSyllabus = () => {
    exportToCsv(
      `${myDept?.code || 'DEPT'}_Curriculum_Syllabus`,
      filteredSubjects,
      [
        { header: 'Course Code', accessor: (r) => r.code || '' },
        { header: 'Subject Name', accessor: (r) => r.name || '' },
        { header: 'Semester', accessor: (r) => r.semester || '' },
        { header: 'Credits', accessor: (r) => r.credits || '' },
        { header: 'Subject Type', accessor: (r) => (r.isLab ? 'Laboratory' : r.name?.toLowerCase().includes('project') ? 'Project' : 'Theory') },
        { header: 'Degree Program', accessor: (r) => r.course?.name || '' },
        { header: 'Department', accessor: (r) => r.department?.name || myDept?.name || '' },
        {
          header: 'Assigned Faculty',
          accessor: (r) =>
            getSubjectAssignedFaculty(r)
              .map((f) => `${f.name}${f.designation ? ' (' + f.designation + ')' : ''}`)
              .join('; ') || 'Unassigned'
        },
        { header: 'Syllabus Status', accessor: (r) => (r.syllabusUrl ? 'Syllabus Attached' : 'Core Syllabus Standard') }
      ]
    );
    addToast({ type: 'success', title: 'Export Generated', message: 'Curriculum syllabus downloaded as CSV.' });
  };

  const handleExportAtRisk = () => {
    exportToCsv(
      `${myDept?.code || 'DEPT'}_Academic_Attention_Alerts`,
      filteredAtRisk,
      [
        { header: 'Roll Number', accessor: (r) => r.student?.rollNumber || '' },
        { header: 'Student Name', accessor: (r) => r.student?.user?.name || '' },
        { header: 'Email Address', accessor: (r) => r.student?.user?.email || '' },
        { header: 'Semester', accessor: (r) => r.student?.currentSemester || '' },
        { header: 'Alert Category', accessor: (r) => r.alertType },
        { header: 'Attendance %', accessor: (r) => (r.attendancePct !== null ? `${r.attendancePct}%` : 'N/A') },
        { header: 'Reason & Detail', accessor: (r) => r.reason }
      ]
    );
    addToast({ type: 'success', title: 'Export Generated', message: 'Academic alerts list downloaded as CSV.' });
  };

  // Comprehensive Unified Academic Alerts System derived from live authorized records
  const allDepartmentAlerts = useMemo(() => {
    const list = [];

    // 1. Student Attendance shortage (<75%)
    deptStudents.forEach((stud) => {
      const studId = stud._id || stud.id;
      const studRoll = stud.rollNumber;
      const studAttRecords = attendanceRecords.filter(
        (att) =>
          (att.student?._id && String(att.student._id) === String(studId)) ||
          (att.student?.rollNumber && att.student.rollNumber === studRoll) ||
          (att.student && String(att.student) === String(studId))
      );
      if (studAttRecords.length > 0) {
        const presentCount = studAttRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
        const pct = Number(((presentCount / studAttRecords.length) * 100).toFixed(1));
        if (pct < 75) {
          const isCritical = pct < 60;
          list.push({
            id: `att-shortage-${studId}`,
            title: `Attendance Shortage: ${stud.user?.name || stud.rollNumber}`,
            category: 'Attendance Shortage',
            severity: isCritical ? 'Critical' : 'High',
            severityWeight: isCritical ? 4 : 3,
            description: `Current attendance rate is ${pct}%, below the institutional 75% minimum requirement (${presentCount} attended out of ${studAttRecords.length} recorded class sessions).`,
            relatedEntity: `${stud.user?.name || 'Student'} (Roll: ${stud.rollNumber || '—'})`,
            entityType: 'student',
            semester: stud.currentSemester || '3',
            section: stud.section || 'A',
            dateDetected: new Date().toISOString(),
            rawDate: new Date(),
            sourceRecord: { student: stud, attendancePct: pct, totalClasses: studAttRecords.length, presentClasses: presentCount },
            actionLabel: 'Open Attendance Register',
            actionHandler: () => navigate('/attendance')
          });
        }
      }
    });

    // 2. Student Examination Performance & Academic Risk (<40 marks or failed)
    deptStudents.forEach((stud) => {
      const studId = stud._id || stud.id;
      const studRoll = stud.rollNumber;
      const studResults = resultsList.filter(
        (res) =>
          (res.student?._id && String(res.student._id) === String(studId)) ||
          (res.student?.rollNumber && res.student.rollNumber === studRoll) ||
          (res.student && String(res.student) === String(studId))
      );
      studResults.forEach((res) => {
        const isFailed = res.status === 'failed' || (res.totalMarks !== undefined && res.totalMarks < 35);
        const isLowMarks = (res.totalMarks !== undefined && res.totalMarks < 40) || (res.internalMarks !== undefined && res.internalMarks < 16);
        if (isFailed || isLowMarks) {
          list.push({
            id: `acad-risk-${studId}-${res._id || res.id}`,
            title: `Academic Performance Concern: ${stud.user?.name || stud.rollNumber}`,
            category: 'Academic Risk',
            severity: isFailed ? 'Critical' : 'High',
            severityWeight: isFailed ? 4 : 3,
            description: `Student scored ${res.totalMarks !== undefined ? `${res.totalMarks}/100` : `${res.internalMarks} internal marks`} in ${res.subject?.code || res.subject?.name || 'Subject'} (Grade: ${res.grade || res.status || 'Fail'}).`,
            relatedEntity: `${stud.user?.name || 'Student'} • ${res.subject?.code || 'Course'}`,
            entityType: 'student',
            semester: res.examination?.semester || stud.currentSemester || '3',
            section: stud.section || 'A',
            dateDetected: res.updatedAt || res.createdAt || new Date().toISOString(),
            rawDate: new Date(res.updatedAt || res.createdAt || Date.now()),
            sourceRecord: { student: stud, result: res },
            actionLabel: 'View Results Analysis',
            actionHandler: () => navigate('/results')
          });
        }
      });
    });

    // 3. Unrecorded Subject Attendance (0 Sessions Registered in department)
    deptSubjects.forEach((sub) => {
      const subId = sub._id || sub.id;
      const subRecords = attendanceRecords.filter(
        (a) => a.subject?._id === subId || a.subject === subId || a.subject?.code === sub.code
      );
      if (subRecords.length === 0) {
        list.push({
          id: `unrec-att-${subId}`,
          title: `Unrecorded Course Attendance: ${sub.name}`,
          category: 'Attendance Register',
          severity: 'Medium',
          severityWeight: 2,
          description: `Course ${sub.code} (Semester ${sub.semester}, ${sub.credits} Credits) has zero attendance registers marked for current academic term.`,
          relatedEntity: `${sub.code} - ${sub.name}`,
          entityType: 'subject',
          semester: sub.semester || '3',
          section: 'All Sections',
          dateDetected: sub.updatedAt || sub.createdAt || new Date().toISOString(),
          rawDate: new Date(sub.updatedAt || sub.createdAt || Date.now()),
          sourceRecord: { subject: sub },
          actionLabel: 'Open Attendance Register',
          actionHandler: () => navigate('/attendance')
        });
      }
    });

    // 4. Timetable Incomplete Allocation & Master Conflicts
    deptTimetable.forEach((slot, idx) => {
      if (!slot.faculty || !slot.roomNumber) {
        const isMissingBoth = !slot.faculty && !slot.roomNumber;
        list.push({
          id: `slot-unassigned-${slot._id || slot.id || idx}`,
          title: `Incomplete Timetable Allocation: Period ${slot.periodNumber} (${(slot.dayOfWeek || '').toUpperCase()})`,
          category: 'Timetable Allocation',
          severity: isMissingBoth ? 'High' : 'Medium',
          severityWeight: isMissingBoth ? 3 : 2,
          description: `Lecture session for ${slot.subject?.name || 'Class'} (${slot.subject?.code || 'Subject'}) requires ${!slot.faculty ? 'faculty instructor assignment' : 'classroom venue allotment'}.`,
          relatedEntity: `${slot.subject?.code || 'Slot'} • Period ${slot.periodNumber}`,
          entityType: 'timetable',
          semester: slot.semester || '3',
          section: slot.section || 'A',
          dateDetected: slot.updatedAt || slot.createdAt || new Date().toISOString(),
          rawDate: new Date(slot.updatedAt || slot.createdAt || Date.now()),
          sourceRecord: { slot },
          actionLabel: 'Review Timetable',
          actionHandler: () => {
            handleTabChange('timetable');
            setTimeout(() => {
              document.getElementById('hod-timetable-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          }
        });
      }
    });

    timetableConflicts.forEach((conflict) => {
      list.push({
        id: `conflict-${conflict.id}`,
        title: `Master Timetable Conflict: ${conflict.type?.toUpperCase()} Clash`,
        category: 'Timetable Allocation',
        severity: 'Critical',
        severityWeight: 4,
        description: conflict.message,
        relatedEntity: `Timetable Clash (${conflict.type})`,
        entityType: 'timetable',
        semester: 'All Semesters',
        section: 'All Sections',
        dateDetected: new Date().toISOString(),
        rawDate: new Date(),
        sourceRecord: { conflict },
        actionLabel: 'Review Timetable',
        actionHandler: () => {
          handleTabChange('timetable');
          setTimeout(() => {
            document.getElementById('hod-timetable-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      });
    });

    // 5. Upcoming Examination Deadlines & Milestones
    const nowDate = new Date();
    nowDate.setHours(0, 0, 0, 0);

    allExams.forEach((exam) => {
      const examStart = new Date(exam.startDate);
      const examEnd = new Date(exam.endDate || exam.startDate);
      const isRelevant =
        (examEnd >= nowDate || exam.status === 'scheduled' || exam.status === 'ongoing') &&
        exam.status !== 'completed' &&
        exam.status !== 'cancelled';
      if (isRelevant) {
        const daysLeft = Math.ceil((examStart - nowDate) / (1000 * 60 * 60 * 24));
        const isOngoing = exam.status === 'ongoing';
        const isUrgent = isOngoing || daysLeft <= 2;
        list.push({
          id: `exam-deadline-${exam._id || exam.id}`,
          title: `Upcoming Examination: ${exam.name}`,
          category: 'Assessment Deadlines',
          severity: isUrgent ? 'High' : daysLeft <= 7 ? 'Medium' : 'Low',
          severityWeight: isUrgent ? 3 : daysLeft <= 7 ? 2 : 1,
          description: `${exam.examType} scheduled for Semester ${exam.semester} at ${exam.venue || 'Exam Hall'}. ${isOngoing ? 'Currently ongoing.' : `Commences in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}`,
          relatedEntity: `${exam.name} • Sem ${exam.semester}`,
          entityType: 'exam',
          semester: exam.semester || '3',
          section: 'All Sections',
          dateDetected: examStart.toISOString(),
          rawDate: examStart,
          sourceRecord: { exam, daysLeft, isOngoing },
          actionLabel: 'View Exam Schedule',
          actionHandler: () => navigate('/examinations')
        });
      }
    });

    // 6. Urgent Notices / Circulars
    allNotices.forEach((notice) => {
      if (notice.priority === 'urgent' && notice.status === 'published') {
        const pDate = new Date(notice.publicationDate || notice.createdAt);
        list.push({
          id: `notice-alert-${notice._id || notice.id}`,
          title: `Urgent Circular: ${notice.title}`,
          category: 'Department Circulars',
          severity: 'High',
          severityWeight: 3,
          description: `High-priority institutional circular: ${notice.title}. Category: ${notice.category || 'General'}.`,
          relatedEntity: `Circular: ${notice.title}`,
          entityType: 'notice',
          semester: 'All Semesters',
          section: 'All Sections',
          dateDetected: pDate.toISOString(),
          rawDate: pDate,
          sourceRecord: { notice },
          actionLabel: 'Read Notice',
          actionHandler: () => navigate('/notices')
        });
      }
    });

    return list;
  }, [
    deptStudents,
    attendanceRecords,
    resultsList,
    deptSubjects,
    deptTimetable,
    timetableConflicts,
    allExams,
    allNotices,
    navigate
  ]);

  const filteredDepartmentAlerts = useMemo(() => {
    return allDepartmentAlerts
      .filter((alert) => {
        // Search filter
        let qMatch = true;
        if (alertsSearch && alertsSearch.trim()) {
          const q = alertsSearch.trim().toLowerCase();
          const title = (alert.title || '').toLowerCase();
          const desc = (alert.description || '').toLowerCase();
          const entity = (alert.relatedEntity || '').toLowerCase();
          const cat = (alert.category || '').toLowerCase();
          qMatch = title.includes(q) || desc.includes(q) || entity.includes(q) || cat.includes(q);
        }

        // Category filter
        const catMatch =
          !alertsCategoryFilter || alertsCategoryFilter === 'All' || alert.category === alertsCategoryFilter;

        // Severity filter
        const sevMatch =
          !alertsSeverityFilter || alertsSeverityFilter === 'All' || alert.severity === alertsSeverityFilter;

        // Status filter
        const isAck = acknowledgedAlertIds.has(alert.id);
        const statusMatch =
          !alertsStatusFilter ||
          alertsStatusFilter === 'All' ||
          (alertsStatusFilter === 'pending' && !isAck) ||
          (alertsStatusFilter === 'acknowledged' && isAck);

        // Semester filter
        const semMatch =
          !alertsSemesterFilter ||
          alertsSemesterFilter === 'All' ||
          String(alert.semester) === String(alertsSemesterFilter) ||
          alert.semester === 'All Semesters';

        return qMatch && catMatch && sevMatch && statusMatch && semMatch;
      })
      .sort((a, b) => {
        if (alertsSortBy === 'priority-desc') {
          return (b.severityWeight || 0) - (a.severityWeight || 0);
        }
        if (alertsSortBy === 'priority-asc') {
          return (a.severityWeight || 0) - (b.severityWeight || 0);
        }
        if (alertsSortBy === 'date-desc') {
          return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
        }
        if (alertsSortBy === 'date-asc') {
          return new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime();
        }
        if (alertsSortBy === 'title-asc') {
          return (a.title || '').localeCompare(b.title || '');
        }
        return 0;
      });
  }, [
    allDepartmentAlerts,
    alertsSearch,
    alertsCategoryFilter,
    alertsSeverityFilter,
    alertsStatusFilter,
    alertsSemesterFilter,
    alertsSortBy,
    acknowledgedAlertIds
  ]);

  const totalAlertsCount = allDepartmentAlerts.length;
  const highPriorityAlertsCount = allDepartmentAlerts.filter(
    (a) => a.severity === 'Critical' || a.severity === 'High'
  ).length;
  const pendingAlertsCount = allDepartmentAlerts.filter(
    (a) => !acknowledgedAlertIds.has(a.id)
  ).length;
  const acknowledgedAlertsCount = allDepartmentAlerts.filter(
    (a) => acknowledgedAlertIds.has(a.id)
  ).length;

  const distinctAlertCategories = useMemo(() => {
    const cats = new Set();
    allDepartmentAlerts.forEach((a) => {
      if (a.category) cats.add(a.category);
    });
    return Array.from(cats).sort();
  }, [allDepartmentAlerts]);

  const handleExportDepartmentAlerts = () => {
    exportToCsv(
      `${myDept?.code || 'DEPT'}_Academic_Alerts`,
      filteredDepartmentAlerts,
      [
        { header: 'Alert Title', accessor: (r) => r.title || '' },
        { header: 'Category', accessor: (r) => r.category || '' },
        { header: 'Severity', accessor: (r) => r.severity || '' },
        { header: 'Related Entity', accessor: (r) => r.relatedEntity || '' },
        { header: 'Semester', accessor: (r) => r.semester || '' },
        { header: 'Section', accessor: (r) => r.section || '' },
        { header: 'Description', accessor: (r) => r.description || '' },
        { header: 'Date Detected', accessor: (r) => new Date(r.rawDate).toLocaleDateString() },
        { header: 'Review Status', accessor: (r) => (acknowledgedAlertIds.has(r.id) ? 'Acknowledged' : 'Pending Action') }
      ]
    );
    addToast({
      type: 'success',
      title: 'Alerts Exported',
      message: 'Department academic alerts catalog downloaded as CSV.'
    });
  };

  if (isHodRole) {
    if (!myDept) {
      return (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-navy-950 to-teal-950 rounded-2xl p-6 text-white shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-amber-500/30">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                <span>Department Leadership Notice</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">HOD Account Not Yet Assigned to a Department</h1>
              <p className="mt-1 text-xs sm:text-sm text-navy-200 font-light">
                Logged in as: {user?.name} ({user?.email}) &bull; Status: Active HOD Account
              </p>
            </div>
            <Button variant="secondary" size="md" onClick={loadData} icon={RefreshCw} isLoading={isLoading}>
              Refresh Status
            </Button>
          </div>

          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 shadow-subtle flex items-start space-x-3.5 text-xs sm:text-sm">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-amber-900">Action Required: Awaiting Department Designation</h3>
              <p className="text-amber-800 text-xs font-light leading-relaxed">
                Your user profile holds HOD privileges, but your account has not yet been designated as the Head of Department for any specific engineering branch in the system registry. Please contact the Principal or Super Administrator to ratify your department allotment.
              </p>
            </div>
          </div>

          <Card title="Institutional Departments & Leadership State" subtitle="Current HOD designations across college branches">
            <Table
              columns={deptColumns}
              data={departments}
              keyField="id"
              isLoading={isLoading}
              emptyMessage="No departments configured."
            />
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Warm Amber Hero Banner */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-800 rounded-2xl p-6 sm:p-7 text-white shadow-card relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-black/20 text-amber-200 text-xs font-medium mb-3 backdrop-blur-sm border border-white/10">
              <span>{myDept?.name || user?.department || 'Department Administration'}</span>
              <span>&darr;</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-amber-100 tracking-wide">
              Welcome, {user?.name || 'Department Head'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              Department Head Dashboard
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-amber-100/90 font-normal">
              Department administration, faculty oversight, and student academic performance
            </p>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              icon={RefreshCw}
              isLoading={isLoading}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              Refresh
            </Button>
            <CampusBuildingGraphic className="w-48 h-24 sm:w-56 sm:h-28 opacity-90 text-white pointer-events-none drop-shadow-md hidden md:block" />
          </div>
        </div>

        {/* Feature D: HOD Dashboard Quick Actions Shortcuts */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                Department Workflows & Quick Shortcuts
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Direct Leadership Portals</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            <button
              onClick={() => {
                handleTabChange('faculty');
                setTimeout(() => {
                  document.getElementById('hod-roster-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <Users className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Faculty Roster</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{deptFaculty.length} Allocated</p>
            </button>
            <button
              onClick={() => {
                handleTabChange('students');
                setTimeout(() => {
                  document.getElementById('hod-students-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Student Cohort</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{deptStudents.length} Enrolled</p>
            </button>
            <button
              onClick={() => navigate('/attendance')}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Attendance</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Mark & Review</p>
            </button>
            <button
              onClick={() => navigate('/examinations')}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Examinations</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Schedule & Venues</p>
            </button>
            <button
              onClick={() => navigate('/results')}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <FileText className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Results Analysis</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Marks & Grades</p>
            </button>
            <button
              onClick={() => {
                handleTabChange('timetable');
                setTimeout(() => {
                  document.getElementById('hod-timetable-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Timetable</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{deptTimetable.length} Master Slots</p>
            </button>
            <button
              onClick={() => {
                handleTabChange('curriculum');
                setTimeout(() => {
                  document.getElementById('hod-curriculum-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Curriculum</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{deptSubjects.length} Courses</p>
            </button>
            <button
              onClick={() => {
                handleTabChange('alerts');
                setTimeout(() => {
                  document.getElementById('hod-alerts-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Academic Alerts</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{pendingAlertsCount} Flagged</p>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <Layers className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Reports</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Institutional Logs</p>
            </button>
            <button
              onClick={() => navigate('/notices')}
              className="p-3 rounded-xl border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group cursor-pointer"
            >
              <Bell className="w-4 h-4 text-amber-600 mb-1.5 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold text-slate-800">Notice Board</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Circulars</p>
            </button>
          </div>
        </div>

        {/* Real KPI Cards Scoped to Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => {
              handleTabChange('students');
              setTimeout(() => {
                document.getElementById('hod-students-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click to view enrolled department students"
          >
            <StatWidget
              title="Total Students"
              value={deptStudents.length}
              subtitle={`${deptStudents.length} Enrolled`}
              icon={Users}
              color="amber"
            />
          </div>
          <div
            onClick={() => handleTabChange('faculty')}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click to view department faculty"
          >
            <StatWidget
              title="Faculty Members"
              value={deptFaculty.length}
              subtitle={`${deptFaculty.length} Teaching Staff`}
              icon={GraduationCap}
              color="amber"
            />
          </div>
          <div
            onClick={() => {
              handleTabChange('curriculum');
              setTimeout(() => {
                document.getElementById('hod-curriculum-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click to view department curriculum"
          >
            <StatWidget
              title="Curriculum"
              value={deptSubjects.length}
              subtitle={`${deptSubjects.length} Curriculum Courses`}
              icon={BookOpen}
              color="amber"
            />
          </div>
          <div
            onClick={() => navigate('/attendance')}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click to open Attendance Register"
          >
            <StatWidget
              title="Attendance"
              value={attendanceSummary?.hasRecords ? `${attendanceSummary.percentage}%` : 'N/A'}
              subtitle={
                attendanceSummary?.hasRecords
                  ? `${attendanceSummary.presentClasses}/${attendanceSummary.totalClasses} classes marked`
                  : 'No attendance records yet'
              }
              icon={CalendarCheck}
              color="amber"
            />
          </div>
        </div>

        {/* Feature B & C Row: HOD Action Center & Academic Deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Feature B: HOD Action Center */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Department Action Center</h2>
                </div>
                <Badge variant={actionItems.length > 0 ? 'amber' : 'teal'} size="xs">
                  {actionItems.length} {actionItems.length === 1 ? 'Action Required' : 'Actions Required'}
                </Badge>
              </div>

              {actionItems.length === 0 ? (
                <div className="py-7 text-center rounded-xl bg-emerald-50/60 border border-emerald-100 p-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-emerald-900">Action Center Clear</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    All department academic submissions, attendance registers, and circulars are up to date.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                  {actionItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-slate-900 truncate block">{item.title}</span>
                          <Badge variant={item.badgeVariant} size="xs">
                            {item.urgency}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{item.description}</p>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {item.secondaryActionLabel && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={item.onSecondaryClick}
                          >
                            {item.secondaryActionLabel}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={item.onClick}
                          isLoading={item.isLoading}
                          className="font-semibold text-amber-700 hover:text-amber-800"
                        >
                          {item.actionLabel}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Automatic tracking based on live ERP state</span>
              <button
                onClick={loadData}
                className="text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
              >
                Re-check
              </button>
            </div>
          </div>

          {/* Feature C: Academic Alerts and Deadline Tracking */}
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Academic Alerts & Deadlines</h2>
                </div>
                <div className="flex items-center space-x-1 text-[11px] bg-slate-100 p-0.5 rounded-lg">
                  {['All', 'Exams', 'Circulars'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDeadlinesFilter(tab)}
                      className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                        deadlinesFilter === tab
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {filteredDeadlines.length === 0 ? (
                <div className="py-7 text-center rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No Pending Academic Deadlines</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No scheduled exams or urgent circulars currently pending.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                  {filteredDeadlines.slice(0, 5).map((dl) => (
                    <div
                      key={dl.id}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-slate-900 truncate block">{dl.title}</span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                              dl.isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {dl.countdown}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{dl.subtitle} &bull; {dl.dateFormatted}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => navigate(dl.link)}
                        icon={ArrowUpRight}
                        className="flex-shrink-0"
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Synchronized with academic calendar</span>
              <button
                onClick={() => navigate('/examinations')}
                className="text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
              >
                All Examinations
              </button>
            </div>
          </div>
        </div>

        {/* Charts Row: Semester-wise Student Strength & Faculty Workload */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-4">Semester-wise Student Strength</h2>
              {deptStudents.length === 0 ? (
                <div className="h-[190px] flex flex-col items-center justify-center text-slate-400">
                  <Users className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs">No student cohort data recorded for this department.</p>
                </div>
              ) : (
                <SimpleBarChart
                  data={semesterStrengthData}
                  height={190}
                  barColor="bg-sky-400"
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-4">Faculty Workload Distribution</h2>
              <div className="flex items-center justify-center py-2">
                <SimpleDonutChart
                  data={facultyWorkloadDonut}
                  centerLabel={deptTimetable.length > 0 ? 'Sessions' : deptSubjects.length > 0 ? 'Subjects' : 'Total'}
                  centerValue={totalWorkload}
                  size={180}
                  strokeWidth={22}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Recent Department Activities & Upcoming Events */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Department Activities</h2>
                <button
                  onClick={() => handleTabChange('faculty')}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
                >
                  View Faculty
                </button>
              </div>
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No recent department activities recorded.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.slice(0, 4).map((log, i) => {
                    const display = getAuditLogDisplay(log);
                    const DisplayIcon = display.icon;
                    return (
                      <div key={log._id || log.id || i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${display.color.split(' ')[1]}`}>
                            <DisplayIcon className={`w-4 h-4 ${display.color.split(' ')[0]}`} />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-slate-800">{display.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{formatTimeAgo(log.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Upcoming Events</h2>
                <button
                  onClick={() => handleTabChange('timetable')}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 cursor-pointer"
                >
                  View Timetable
                </button>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No upcoming examinations or scheduled events.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 4).map((ev, i) => {
                    const EvIcon = ev.icon;
                    return (
                      <div key={ev.id || i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ev.color.split(' ')[1]}`}>
                            <EvIcon className={`w-4 h-4 ${ev.color.split(' ')[0]}`} />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-slate-800">{ev.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{ev.subtitle} &bull; {ev.date}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-navy-200 bg-white px-4 rounded-xl shadow-subtle overflow-x-auto">
          <button
            onClick={() => handleTabChange('faculty')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              isFacultyRosterActive
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Faculty Roster ({deptFaculty.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('students')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              isStudentCohortActive
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student Cohort ({deptStudents.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('timetable')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              isTimetableActive
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Department Timetable ({deptTimetable.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('curriculum')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              isCurriculumActive
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Curriculum & Syllabus ({deptSubjects.length})</span>
          </button>

          {/* TAB 5: Academic Alerts & Compliance */}
          <button
            onClick={() => handleTabChange('alerts')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              isAlertsActive
                ? 'border-amber-600 text-amber-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Academic Alerts ({pendingAlertsCount})</span>
            {pendingAlertsCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {pendingAlertsCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* TAB 1: Department Faculty Roster */}
        {isFacultyRosterActive && (
          <div id="hod-roster-section" className="space-y-4">
            {/* A. Faculty Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Total Faculty</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{totalFacultyCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Authorized in {myDept?.code || 'CSE'}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Active Status</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">{activeFacultyCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Active Teaching Profiles</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Designation Spread</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{profCount} Prof</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-slate-800">{assocProfCount} Assoc</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-slate-800">{asstProfCount} Asst</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Academic Hierarchy</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700">
                  <Award className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Assigned Classes</p>
                  <p className="text-xl font-bold text-indigo-700 mt-0.5">{facultyWithAssignedSubjectsCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {facultyWithAssignedSubjectsCount} of {totalFacultyCount} with Timetable Slots
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-700">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Error Banner with Retry */}
            {facultyFetchError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Error loading faculty roster: {facultyFetchError}</span>
                </div>
                <Button variant="danger" size="xs" onClick={handleRefreshFaculty} icon={RotateCcw}>
                  Retry
                </Button>
              </div>
            )}

            {/* Main Roster Container */}
            <Card
              title={`Faculty Information Roster (${filteredFaculty.length} of ${deptFaculty.length} Members)`}
              subtitle={`Complete authorized faculty records for Department of ${myDept?.name || 'Computer Science & Engineering'}`}
              action={
                <div className="flex items-center space-x-2">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      onClick={() => setFacultyViewMode('table')}
                      className={`px-2 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                        facultyViewMode === 'table' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Table View"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Table</span>
                    </button>
                    <button
                      onClick={() => setFacultyViewMode('cards')}
                      className={`px-2 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                        facultyViewMode === 'cards' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Cards View"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cards</span>
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleRefreshFaculty}
                    isLoading={isRefreshingFaculty}
                    icon={RefreshCw}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleExportFaculty}
                    icon={Download}
                    disabled={filteredFaculty.length === 0}
                  >
                    Export CSV
                  </Button>
                </div>
              }
            >
              {/* Search, Filter & Sort Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 mb-4 pb-3 border-b border-navy-100">
                <div className="relative md:col-span-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, email..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  {facultySearch && (
                    <button
                      onClick={() => setFacultySearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={facultyDesignation}
                    onChange={(e) => setFacultyDesignation(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Designations</option>
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>

                <div>
                  <select
                    value={facultyStatusFilter}
                    onChange={(e) => setFacultyStatusFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Statuses</option>
                    <option value="active">Active Status</option>
                    <option value="inactive">Inactive Status</option>
                    <option value="disabled">Disabled Status</option>
                  </select>
                </div>

                <div>
                  <select
                    value={facultySortBy}
                    onChange={(e) => setFacultySortBy(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="name-asc">Sort: Name (A to Z)</option>
                    <option value="name-desc">Sort: Name (Z to A)</option>
                    <option value="id-asc">Sort: Employee ID (Asc)</option>
                    <option value="id-desc">Sort: Employee ID (Desc)</option>
                    <option value="desig-asc">Sort: Designation</option>
                  </select>
                </div>
              </div>

              {/* Data Rendering */}
              {isRefreshingFaculty ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Reloading faculty roster from database...</p>
                </div>
              ) : filteredFaculty.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-navy-500 font-medium">
                    {deptFaculty.length === 0
                      ? 'No faculty members are currently allocated to this department in the database.'
                      : `No faculty members matched your active search "${facultySearch}" or selected filter criteria.`}
                  </p>
                  {(facultySearch || facultyDesignation !== 'All' || facultyStatusFilter !== 'All') && (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setFacultySearch('');
                        setFacultyDesignation('All');
                        setFacultyStatusFilter('All');
                        setFacultySortBy('name-asc');
                      }}
                      icon={RotateCcw}
                    >
                      Reset Search & Filters
                    </Button>
                  )}
                </div>
              ) : facultyViewMode === 'table' ? (
                /* B. Responsive Faculty Information Table */
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3 px-3.5">Faculty Name</th>
                        <th className="py-3 px-3">Employee ID</th>
                        <th className="py-3 px-3">Email Address</th>
                        <th className="py-3 px-3">Designation</th>
                        <th className="py-3 px-3">Qualification</th>
                        <th className="py-3 px-3">Specialization</th>
                        <th className="py-3 px-3">Assigned Subjects</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredFaculty.map((fac) => {
                        const assignedSubs = getFacultyAssignedSubjects(fac);
                        const status = (fac.user?.status || 'active').toLowerCase();
                        return (
                          <tr key={fac._id || fac.id} className="hover:bg-amber-50/20 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                                  {fac.user?.name
                                    ? fac.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                                    : 'FA'}
                                </div>
                                <span className="font-bold text-slate-900">{fac.user?.name || 'Faculty Member'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 font-medium whitespace-nowrap">
                              {fac.employeeId || '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {fac.user?.email ? (
                                <a
                                  href={`mailto:${fac.user.email}`}
                                  className="text-amber-700 hover:underline hover:text-amber-900 inline-flex items-center gap-1"
                                >
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{fac.user.email}</span>
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <Badge variant="teal" size="xs">
                                {fac.designation || 'Faculty'}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-medium">
                              {fac.qualification || 'M.Tech'}
                            </td>
                            <td className="py-3 px-3 text-slate-600 min-w-[140px]">
                              {fac.specialization || 'Engineering'}
                            </td>
                            <td className="py-3 px-3 min-w-[160px]">
                              {assignedSubs.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {assignedSubs.map((sub, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                      title={sub.name}
                                    >
                                      {sub.code || sub.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No assigned classes</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedFacultyDetails(fac)}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200/80 inline-flex items-center gap-1 cursor-pointer"
                                title="View Faculty Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Details</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Alternative Cards View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredFaculty.map((fac) => {
                    const assignedSubs = getFacultyAssignedSubjects(fac);
                    return (
                      <div
                        key={fac._id || fac.id}
                        className="p-4 rounded-xl bg-warm-50 border border-navy-100 flex flex-col justify-between hover:border-amber-300 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-navy-950 text-xs sm:text-sm">
                              {fac.user?.name || 'Faculty Member'}
                            </span>
                            <Badge variant="teal" size="xs">
                              {fac.designation || 'Faculty'}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-navy-500 font-mono block">
                            {fac.user?.email}
                          </span>
                          <span className="text-xs text-navy-600 mt-2 block font-medium">
                            Specialization: {fac.specialization || 'Engineering'}
                          </span>
                          <span className="text-[11px] text-navy-400 block mt-0.5">
                            Qualification: {fac.qualification || 'M.Tech'}
                          </span>
                          {assignedSubs.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {assignedSubs.map((sub, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                >
                                  {sub.code || sub.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-navy-200/50 flex items-center justify-between text-[11px]">
                          <span className="text-navy-500 font-mono">ID: {fac.employeeId}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-emerald-700 font-semibold">{fac.user?.status || 'Active'}</span>
                            <button
                              onClick={() => setSelectedFacultyDetails(fac)}
                              className="text-amber-600 hover:text-amber-800 font-semibold inline-flex items-center gap-0.5 cursor-pointer ml-1"
                              title="View Faculty Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 2: Department Students / Student Cohort */}
        {isStudentCohortActive && (
          <div id="hod-students-section" className="space-y-4">
            {/* A. Student Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Total Enrolled</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{totalStudentsCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Authorized in {myDept?.code || 'CSE'}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Active Enrollments</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">{activeStudentsCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">In Good Academic Standing</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Semester Spread</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {distinctSemesters.length === 0 ? (
                      <span className="text-xs text-slate-400">None</span>
                    ) : (
                      distinctSemesters.map((sem) => {
                        const count = deptStudents.filter((s) => Number(s.currentSemester) === sem).length;
                        return (
                          <span key={sem} className="text-xs font-bold text-slate-800">
                            Sem {sem} ({count})
                          </span>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {distinctBatches.length > 0 ? `Batches: ${distinctBatches.join(', ')}` : 'Department Cohorts'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Academic Attention</p>
                  <p className={`text-xl font-bold mt-0.5 ${studentsRequiringAttentionCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {studentsRequiringAttentionCount}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {studentsRequiringAttentionCount > 0
                      ? `${studentsRequiringAttentionCount} Flagged for Review`
                      : 'All in Good Standing'}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  studentsRequiringAttentionCount > 0
                    ? 'bg-rose-50 border-rose-200/60 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200/60 text-emerald-700'
                }`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Error Banner with Retry */}
            {studentFetchError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Error loading student cohort: {studentFetchError}</span>
                </div>
                <Button variant="danger" size="xs" onClick={handleRefreshStudents} icon={RotateCcw}>
                  Retry
                </Button>
              </div>
            )}

            {/* Main Student Cohort Container */}
            <Card
              title={`Department Student Cohort (${filteredStudents.length} of ${deptStudents.length} Students)`}
              subtitle={`Complete authorized undergraduate cohorts in Department of ${myDept?.name || 'Computer Science & Engineering'}`}
              action={
                <div className="flex items-center space-x-2">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      onClick={() => setStudentViewMode('table')}
                      className={`px-2 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                        studentViewMode === 'table' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Table View"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Table</span>
                    </button>
                    <button
                      onClick={() => setStudentViewMode('cards')}
                      className={`px-2 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                        studentViewMode === 'cards' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Cards View"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cards</span>
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleRefreshStudents}
                    isLoading={isRefreshingStudents}
                    icon={RefreshCw}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleExportStudents}
                    icon={Download}
                    disabled={filteredStudents.length === 0}
                  >
                    Export CSV
                  </Button>
                </div>
              }
            >
              {/* Search, Filter & Sort Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 mb-4 pb-3 border-b border-navy-100">
                <div className="relative md:col-span-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type="text"
                    placeholder="Search by name, roll, email, course..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={studentSemester}
                    onChange={(e) => setStudentSemester(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={studentBatchFilter}
                    onChange={(e) => setStudentBatchFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Academic Batches</option>
                    {distinctBatches.map((b) => (
                      <option key={b} value={b}>Batch {b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={studentStatusFilter}
                    onChange={(e) => setStudentStatusFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Statuses</option>
                    <option value="enrolled">Enrolled Status</option>
                    <option value="graduated">Graduated Status</option>
                    <option value="suspended">Suspended Status</option>
                    <option value="withdrawn">Withdrawn Status</option>
                  </select>
                </div>

                <div>
                  <select
                    value={studentSortBy}
                    onChange={(e) => setStudentSortBy(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="roll-asc">Sort: Roll Number (Asc)</option>
                    <option value="roll-desc">Sort: Roll Number (Desc)</option>
                    <option value="name-asc">Sort: Name (A to Z)</option>
                    <option value="name-desc">Sort: Name (Z to A)</option>
                    <option value="sem-asc">Sort: Semester (Low to High)</option>
                    <option value="sem-desc">Sort: Semester (High to Low)</option>
                  </select>
                </div>
              </div>

              {/* Data Rendering */}
              {isRefreshingStudents ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Reloading student cohort from database...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-navy-500 font-medium">
                    {deptStudents.length === 0
                      ? 'No students are currently registered in this department cohort.'
                      : `No students matched your active search "${studentSearch}" or selected filter criteria.`}
                  </p>
                  {(studentSearch || studentSemester !== 'All' || studentBatchFilter !== 'All' || studentStatusFilter !== 'All') && (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setStudentSearch('');
                        setStudentSemester('All');
                        setStudentBatchFilter('All');
                        setStudentStatusFilter('All');
                        setStudentSortBy('roll-asc');
                      }}
                      icon={RotateCcw}
                    >
                      Reset Search & Filters
                    </Button>
                  )}
                </div>
              ) : studentViewMode === 'table' ? (
                /* B. Responsive Student Information Table */
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3 px-3.5">Student Name</th>
                        <th className="py-3 px-3">Roll / Reg Number</th>
                        <th className="py-3 px-3">Email Address</th>
                        <th className="py-3 px-3 text-center">Semester</th>
                        <th className="py-3 px-3 text-center">Section</th>
                        <th className="py-3 px-3">Academic Year</th>
                        <th className="py-3 px-3">Program / Course</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredStudents.map((stud) => {
                        const status = (stud.admissionStatus || stud.user?.status || 'enrolled').toLowerCase();
                        return (
                          <tr key={stud._id || stud.id} className="hover:bg-amber-50/20 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                                  {stud.user?.name
                                    ? stud.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                                    : 'ST'}
                                </div>
                                <span className="font-bold text-slate-900">{stud.user?.name || 'Student'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-teal-900 block">{stud.rollNumber}</span>
                              {stud.enrollmentNumber && (
                                <span className="font-mono text-[10px] text-slate-400 block">Enr: {stud.enrollmentNumber}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {stud.user?.email ? (
                                <a
                                  href={`mailto:${stud.user.email}`}
                                  className="text-slate-600 hover:text-amber-700 flex items-center gap-1 font-mono transition-colors"
                                  title={`Email ${stud.user.email}`}
                                >
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{stud.user.email}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                                Sem {stud.currentSemester}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap text-slate-500 font-medium">
                              {stud.section || 'A'}
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                              {stud.batchYear || '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                              {stud.course?.code || stud.course?.name || stud.department?.code || 'B.Tech CSE'}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  status === 'enrolled' || status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : status === 'suspended'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {stud.admissionStatus || 'Enrolled'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => setSelectedStudentDetails(stud)}
                                  className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200/80 inline-flex items-center gap-1 cursor-pointer"
                                  title="View Student Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Details</span>
                                </button>
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => navigate('/attendance')}
                                  title="Attendance Register"
                                >
                                  Attendance
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => navigate('/results')}
                                  title="Results Analysis"
                                >
                                  Results
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Alternative Cards View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredStudents.map((stud) => {
                    const status = (stud.admissionStatus || stud.user?.status || 'enrolled').toLowerCase();
                    return (
                      <div
                        key={stud._id || stud.id}
                        className="p-4 rounded-xl bg-warm-50 border border-navy-100 flex flex-col justify-between hover:border-amber-300 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-navy-950 text-xs sm:text-sm">
                              {stud.user?.name || 'Student'}
                            </span>
                            <Badge
                              variant={
                                status === 'enrolled' || status === 'active'
                                  ? 'teal'
                                  : status === 'suspended'
                                  ? 'danger'
                                  : 'neutral'
                              }
                              size="xs"
                            >
                              {stud.admissionStatus || 'Enrolled'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-teal-800">{stud.rollNumber}</span>
                            {stud.enrollmentNumber && (
                              <span className="font-mono text-[11px] text-navy-400">({stud.enrollmentNumber})</span>
                            )}
                          </div>
                          <span className="text-[11px] text-navy-500 font-mono block mt-1">
                            {stud.user?.email}
                          </span>
                          <div className="mt-2 text-xs text-navy-600 font-medium space-y-0.5">
                            <div>Program: {stud.course?.name || stud.course?.code || 'B.Tech CSE'}</div>
                            <div>Batch Year: {stud.batchYear || '—'} &bull; Section {stud.section || 'A'}</div>
                          </div>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-navy-200/50 flex items-center justify-between text-[11px]">
                          <span className="text-xs font-bold text-navy-800 px-2 py-0.5 rounded bg-white border border-navy-100">
                            Sem {stud.currentSemester}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => setSelectedStudentDetails(stud)}
                              className="text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-0.5 cursor-pointer px-1.5 py-0.5 rounded hover:bg-amber-50"
                              title="View Student Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => navigate('/attendance')}
                            >
                              Att
                            </Button>
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => navigate('/results')}
                            >
                              Res
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: Timetable */}
        {isTimetableActive && (
          <div id="hod-timetable-section" className="space-y-4">
            {/* A. Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StatWidget
                title="Weekly Sessions"
                value={deptTimetable.length}
                subtitle={`${filteredTimetable.length} Filtered / Displayed`}
                icon={Clock}
                color="amber"
              />
              <StatWidget
                title="Active Teaching Days"
                value={new Set(deptTimetable.map((s) => s.dayOfWeek?.toLowerCase()).filter(Boolean)).size}
                subtitle="Mon - Sat Weekly Schedule"
                icon={Calendar}
                color="amber"
              />
              <StatWidget
                title="Session Breakdown"
                value={`${deptTimetable.filter((s) => !s.subject?.isLab).length} Theory`}
                subtitle={`${deptTimetable.filter((s) => !!s.subject?.isLab).length} Lab / Practical Slots`}
                icon={BookOpen}
                color="amber"
              />
              <StatWidget
                title="Faculty Allocation"
                value={`${Math.round(deptTimetable.length > 0 ? (deptTimetable.filter((s) => !!(s.faculty?.user?.name || s.faculty?.name || s.faculty?._id)).length / deptTimetable.length) * 100 : 100)}%`}
                subtitle={`${deptTimetable.filter((s) => !!(s.faculty?.user?.name || s.faculty?.name || s.faculty?._id)).length} of ${deptTimetable.length} Assigned`}
                icon={Users}
                color="amber"
              />
            </div>

            {/* Error Banner with Retry */}
            {timetableFetchError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{timetableFetchError}</span>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={handleRefreshTimetable}
                  className="flex-shrink-0"
                >
                  Retry Connection
                </Button>
              </div>
            )}

            {/* Conflict Detection Banner */}
            {timetableConflicts.length > 0 ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Schedule Conflicts Detected ({timetableConflicts.length})</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-rose-700">
                  {timetableConflicts.map((c) => (
                    <li key={c.id}>{c.message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">All department timetable slots are conflict-free across rooms, faculty, and sections.</span>
                </div>
                <Badge variant="emerald" size="xs">Conflict-Free</Badge>
              </div>
            )}

            {/* Main Timetable Card */}
            <Card
              title={`Department Timetable Schedule (${filteredTimetable.length} of ${deptTimetable.length} Sessions)`}
              subtitle={`Weekly teaching slots, rooms, and faculty allocations for ${myDept?.name || 'Department'}`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setTimetableTabMode('grouped')}
                      className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                        timetableTabMode === 'grouped'
                          ? 'bg-white text-slate-900 font-bold shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Grouped by Day view"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Day View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimetableTabMode('table')}
                      className={`flex items-center space-x-1 px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                        timetableTabMode === 'table'
                          ? 'bg-white text-slate-900 font-bold shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Table List view"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Table View</span>
                    </button>
                  </div>

                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleRefreshTimetable}
                    isLoading={isRefreshingTimetable}
                    icon={RefreshCw}
                  >
                    Refresh
                  </Button>

                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleExportTimetable}
                    icon={Download}
                  >
                    Export (CSV)
                  </Button>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => navigate('/timetable')}
                    icon={ExternalLink}
                  >
                    Timetable Manager
                  </Button>
                </div>
              }
            >
              {/* Filter and Search Bar */}
              <div className="space-y-3 mb-4 pb-4 border-b border-navy-100">
                {/* Search Bar & Reset */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search timetable by subject, code, room, or faculty name..."
                      value={timetableSearch}
                      onChange={(e) => setTimetableSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                    />
                    {timetableSearch && (
                      <button
                        onClick={() => setTimetableSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {(timetableSearch ||
                    timetableDay !== 'All' ||
                    timetableSemester !== 'All' ||
                    timetableSection !== 'All' ||
                    timetableFaculty !== 'All' ||
                    timetableType !== 'All' ||
                    timetableSortBy !== 'chronological') && (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setTimetableSearch('');
                        setTimetableDay('All');
                        setTimetableSemester('All');
                        setTimetableSection('All');
                        setTimetableFaculty('All');
                        setTimetableType('All');
                        setTimetableSortBy('chronological');
                      }}
                      icon={RotateCcw}
                      className="flex-shrink-0"
                    >
                      Reset All
                    </Button>
                  )}
                </div>

                {/* Filter Dropdowns Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  {/* Day Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Day of Week</label>
                    <select
                      value={timetableDay}
                      onChange={(e) => setTimetableDay(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-xs"
                    >
                      <option value="All">All Days</option>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Semester Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Semester</label>
                    <select
                      value={timetableSemester}
                      onChange={(e) => setTimetableSemester(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-xs"
                    >
                      <option value="All">All Semesters</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={String(s)}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Section Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Section</label>
                    <select
                      value={timetableSection}
                      onChange={(e) => setTimetableSection(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-xs"
                    >
                      <option value="All">All Sections</option>
                      {distinctTimetableSections.map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Faculty Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Faculty</label>
                    <select
                      value={timetableFaculty}
                      onChange={(e) => setTimetableFaculty(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-xs"
                    >
                      <option value="All">All Faculty</option>
                      {distinctTimetableFaculty.map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Session Type Filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Session Type</label>
                    <select
                      value={timetableType}
                      onChange={(e) => setTimetableType(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-xs"
                    >
                      <option value="All">All Types</option>
                      <option value="theory">Theory / Lecture</option>
                      <option value="lab">Lab / Practical</option>
                    </select>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sort Order</label>
                    <select
                      value={timetableSortBy}
                      onChange={(e) => setTimetableSortBy(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white text-xs"
                    >
                      <option value="chronological">Day & Period</option>
                      <option value="time-asc">Start Time</option>
                      <option value="subject-asc">Subject (A-Z)</option>
                      <option value="faculty-asc">Faculty (A-Z)</option>
                    </select>
                  </div>
                </div>

                {/* Result count indicator */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    Showing <strong className="text-slate-800">{filteredTimetable.length}</strong> of{' '}
                    <strong className="text-slate-800">{deptTimetable.length}</strong> scheduled teaching sessions
                  </span>
                  {deptTimetable.length > 0 && filteredTimetable.length !== deptTimetable.length && (
                    <span className="text-amber-600 font-medium">Filtered view active</span>
                  )}
                </div>
              </div>

              {/* Empty State */}
              {filteredTimetable.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">No Timetable Sessions Found</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {deptTimetable.length === 0
                        ? 'No timetable teaching slots have been scheduled yet for this department.'
                        : 'No timetable sessions match your selected search criteria or filter combinations.'}
                    </p>
                  </div>
                  {(timetableSearch ||
                    timetableDay !== 'All' ||
                    timetableSemester !== 'All' ||
                    timetableSection !== 'All' ||
                    timetableFaculty !== 'All' ||
                    timetableType !== 'All') && (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setTimetableSearch('');
                        setTimetableDay('All');
                        setTimetableSemester('All');
                        setTimetableSection('All');
                        setTimetableFaculty('All');
                        setTimetableType('All');
                      }}
                      icon={RotateCcw}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : timetableTabMode === 'grouped' ? (
                /* Mode A: Day-Grouped View */
                <div className="space-y-6">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName) => {
                    if (timetableDay !== 'All' && timetableDay.toLowerCase() !== dayName.toLowerCase()) {
                      return null;
                    }
                    const daySlots = filteredTimetable.filter(
                      (s) => s.dayOfWeek?.toLowerCase() === dayName.toLowerCase()
                    );
                    if (daySlots.length === 0) {
                      if (timetableDay !== 'All') {
                        return (
                          <div key={dayName} className="p-6 text-center border border-dashed border-slate-200 rounded-xl">
                            <p className="text-xs text-slate-400">No classes scheduled on {dayName}.</p>
                          </div>
                        );
                      }
                      return null;
                    }

                    return (
                      <div key={dayName} className="space-y-2.5">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                              {dayName}
                            </h3>
                          </div>
                          <Badge variant="navy" size="xs">
                            {daySlots.length} {daySlots.length === 1 ? 'Session' : 'Sessions'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {daySlots.map((slot) => {
                            const isLab = !!slot.subject?.isLab;
                            const hasFaculty = !!(slot.faculty?.user?.name || slot.faculty?.name);
                            const facultyName = slot.faculty?.user?.name || slot.faculty?.name || 'TBD (Unassigned)';

                            return (
                              <div
                                key={slot._id || slot.id}
                                className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-amber-300 hover:shadow-sm transition-all flex flex-col justify-between space-y-3"
                              >
                                <div className="space-y-2">
                                  {/* Period & Type Top row */}
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800">
                                      Period {slot.periodNumber} &bull; {slot.startTime} - {slot.endTime}
                                    </span>
                                    <Badge variant={isLab ? 'teal' : 'navy'} size="xs">
                                      {isLab ? 'Lab' : 'Theory'}
                                    </Badge>
                                  </div>

                                  {/* Subject Code & Name */}
                                  <div>
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-bold text-sm text-slate-900 line-clamp-1">
                                        {slot.subject?.name || 'Curriculum Subject'}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                                      <span className="font-mono font-semibold text-amber-700">
                                        {slot.subject?.code || 'SUB-000'}
                                      </span>
                                      {slot.subject?.credits && (
                                        <span>&bull; {slot.subject.credits} Credits</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Class & Room */}
                                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                    <span className="text-slate-600 font-medium">
                                      Sem {slot.semester || '1'} &bull; Sec {slot.section || 'A'}
                                    </span>
                                    <span className="inline-flex items-center space-x-1 text-slate-700 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 text-[11px]">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      <span>{slot.roomNumber ? `Room ${slot.roomNumber}` : 'Room TBD'}</span>
                                    </span>
                                  </div>

                                  {/* Faculty row */}
                                  <div className="flex items-center space-x-2 pt-1 text-xs">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                      {facultyName.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-slate-800 truncate text-[11px]">
                                        {facultyName}
                                      </p>
                                      <p className="text-[10px] text-slate-400 truncate">
                                        {slot.faculty?.designation || (hasFaculty ? 'Faculty Member' : 'Instructor Pending')}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* View Details footer */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                                  <button
                                    onClick={() => setSelectedTimetableSlot(slot)}
                                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View Details</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Mode B: Tabular Table View */
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Day & Period</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Semester & Sec</th>
                        <th className="py-2.5 px-3">Venue / Room</th>
                        <th className="py-2.5 px-3">Assigned Faculty</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredTimetable.map((slot) => {
                        const isLab = !!slot.subject?.isLab;
                        const hasFaculty = !!(slot.faculty?.user?.name || slot.faculty?.name);
                        const facultyName = slot.faculty?.user?.name || slot.faculty?.name || 'TBD (Unassigned)';

                        return (
                          <tr key={slot._id || slot.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                              <span className="font-bold block text-slate-800">{slot.dayOfWeek}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{slot.subject?.name || 'Subject'}</span>
                              <span className="text-[11px] font-mono text-amber-700">
                                {slot.subject?.code} {slot.subject?.credits ? `(${slot.subject.credits} Credits)` : ''}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <Badge variant={isLab ? 'teal' : 'navy'} size="xs">
                                {isLab ? 'Lab' : 'Theory'}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                              Sem {slot.semester || '1'} &bull; Sec {slot.section || 'A'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center space-x-1 text-slate-700 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>{slot.roomNumber ? `Room ${slot.roomNumber}` : 'TBD'}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                                  {facultyName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <span className={`block font-medium truncate ${hasFaculty ? 'text-slate-900' : 'text-amber-700 italic'}`}>
                                    {facultyName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 truncate block">
                                    {slot.faculty?.designation || (hasFaculty ? 'Faculty' : 'Pending')}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => setSelectedTimetableSlot(slot)}
                                icon={Eye}
                              >
                                Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Slot Details Modal */}
            {selectedTimetableSlot && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={selectedTimetableSlot.subject?.isLab ? 'teal' : 'navy'} size="xs">
                          {selectedTimetableSlot.subject?.isLab ? 'Laboratory / Practical' : 'Theory Lecture'}
                        </Badge>
                        <span className="font-mono text-xs font-bold text-amber-700">
                          {selectedTimetableSlot.subject?.code}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {selectedTimetableSlot.subject?.name || 'Class Session Details'}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedTimetableSlot(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Time & Venue Block */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Day & Period</span>
                        <p className="font-bold text-slate-800 text-sm mt-0.5">
                          {selectedTimetableSlot.dayOfWeek} (Period {selectedTimetableSlot.periodNumber})
                        </p>
                        <p className="text-slate-500 font-mono mt-0.5">
                          {selectedTimetableSlot.startTime} - {selectedTimetableSlot.endTime} (50 mins)
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Classroom / Venue</span>
                        <p className="font-bold text-slate-800 text-sm mt-0.5 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>{selectedTimetableSlot.roomNumber ? `Room ${selectedTimetableSlot.roomNumber}` : 'Room TBD'}</span>
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          Sem {selectedTimetableSlot.semester} &bull; Section {selectedTimetableSlot.section || 'A'}
                        </p>
                      </div>
                    </div>

                    {/* Course & Department */}
                    <div className="p-3.5 rounded-xl border border-slate-200/70 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Program</span>
                      <p className="font-semibold text-slate-800">
                        {selectedTimetableSlot.course?.name || myDept?.name || 'Academic Degree Program'}
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        Subject Credits: <strong>{selectedTimetableSlot.subject?.credits || 4} Credits</strong> &bull; Department of {myDept?.name}
                      </p>
                    </div>

                    {/* Assigned Faculty Card */}
                    <div className="p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Instructor</span>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                            {(selectedTimetableSlot.faculty?.user?.name || selectedTimetableSlot.faculty?.name || 'T').charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">
                              {selectedTimetableSlot.faculty?.user?.name || selectedTimetableSlot.faculty?.name || 'Unassigned / TBD'}
                            </p>
                            <p className="text-slate-500 text-[11px]">
                              {selectedTimetableSlot.faculty?.designation || 'Instructor'} &bull; {selectedTimetableSlot.faculty?.employeeId || 'ID Pending'}
                            </p>
                            {selectedTimetableSlot.faculty?.user?.email && (
                              <p className="text-slate-400 text-[11px] font-mono">
                                {selectedTimetableSlot.faculty.user.email}
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedTimetableSlot.faculty && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              const facName = selectedTimetableSlot.faculty?.user?.name || selectedTimetableSlot.faculty?.name || '';
                              setSelectedTimetableSlot(null);
                              handleTabChange('faculty');
                              if (facName) setFacultySearch(facName);
                            }}
                          >
                            View in Roster
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedTimetableSlot(null)}
                    >
                      Close Details
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Syllabus */}
        {/* TAB 4: Curriculum & Syllabus */}
        {isCurriculumActive && (
          <div id="hod-curriculum-section" className="space-y-4">
            {/* Curriculum Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Total Subjects</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{totalCurriculumSubjects}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Department curriculum catalog</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Course Breakdown</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{theorySubjectsCount} Theory</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-teal-800">{labSubjectsCount} Lab</span>
                    {projectSubjectsCount > 0 && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs font-bold text-indigo-800">{projectSubjectsCount} Project</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Categorized syllabus courses</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Total Academic Credits</p>
                  <p className="text-xl font-bold text-indigo-700 mt-0.5">{totalCreditsCount} Credits</p>
                  <p className="text-[11px] text-slate-500 font-medium">Cumulative credit weightage</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-700">
                  <Award className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Faculty Allocation</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {facultyAllocatedCount} of {totalCurriculumSubjects}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {facultyAllocatedCount === totalCurriculumSubjects && totalCurriculumSubjects > 0
                      ? '100% Instructors Assigned'
                      : `${facultyAllocatedCount} courses assigned`}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
                  <Users className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Error Banner with Retry */}
            {curriculumFetchError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Error loading department curriculum: {curriculumFetchError}</span>
                </div>
                <Button variant="danger" size="xs" onClick={handleRefreshCurriculum} icon={RotateCcw}>
                  Retry
                </Button>
              </div>
            )}

            {/* Main Curriculum Directory Container */}
            <Card
              title={`Curriculum & Syllabus Directory (${filteredSubjects.length} of ${deptSubjects.length} Courses)`}
              subtitle={`Approved course catalog, syllabus specifications, and credit requirements for ${myDept?.name || 'Department'}`}
              action={
                <div className="flex items-center space-x-2">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    <button
                      onClick={() => setSubjectViewMode('table')}
                      className={`px-2 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                        subjectViewMode === 'table' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Table View"
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Table</span>
                    </button>
                    <button
                      onClick={() => setSubjectViewMode('cards')}
                      className={`px-2 py-1 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors ${
                        subjectViewMode === 'cards' ? 'bg-white shadow-xs text-amber-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Cards View"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cards</span>
                    </button>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleRefreshCurriculum}
                    icon={RefreshCw}
                    isLoading={isRefreshingCurriculum}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleExportSyllabus}
                    icon={Download}
                  >
                    Export (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => navigate('/courses')}
                    icon={ExternalLink}
                  >
                    Course Catalog
                  </Button>
                </div>
              }
            >
              {/* Search, Filter & Sorting Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 mb-4 pb-3 border-b border-navy-100">
                <div className="lg:col-span-2 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type="text"
                    placeholder="Search by code, subject, or faculty..."
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  {subjectSearch && (
                    <button
                      onClick={() => setSubjectSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={subjectSemester}
                    onChange={(e) => setSubjectSemester(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={String(s)}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={subjectType}
                    onChange={(e) => setSubjectType(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Types</option>
                    <option value="Theory">Theory</option>
                    <option value="Lab">Lab</option>
                    <option value="Project">Project</option>
                  </select>
                </div>

                <div>
                  <select
                    value={subjectCreditsFilter}
                    onChange={(e) => setSubjectCreditsFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Credits</option>
                    {[1, 2, 3, 4, 5, 6].map((c) => (
                      <option key={c} value={String(c)}>{c} Credits</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={subjectSortBy}
                    onChange={(e) => setSubjectSortBy(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="code-asc">Sort: Code (A to Z)</option>
                    <option value="code-desc">Sort: Code (Z to A)</option>
                    <option value="name-asc">Sort: Name (A to Z)</option>
                    <option value="name-desc">Sort: Name (Z to A)</option>
                    <option value="sem-asc">Sort: Semester (Asc)</option>
                    <option value="sem-desc">Sort: Semester (Desc)</option>
                    <option value="credits-desc">Sort: Credits (High to Low)</option>
                    <option value="credits-asc">Sort: Credits (Low to High)</option>
                  </select>
                </div>
              </div>

              {/* Data Rendering */}
              {isRefreshingCurriculum ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Reloading curriculum subjects from database...</p>
                </div>
              ) : filteredSubjects.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-navy-500 font-medium">
                    {deptSubjects.length === 0
                      ? 'No curriculum subjects are registered for this department in the database.'
                      : `No subjects matched your active search "${subjectSearch}" or selected filter criteria.`}
                  </p>
                  {(subjectSearch || subjectSemester !== 'All' || subjectType !== 'All' || subjectCreditsFilter !== 'All' || subjectStatusFilter !== 'All') && (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setSubjectSearch('');
                        setSubjectSemester('All');
                        setSubjectType('All');
                        setSubjectCreditsFilter('All');
                        setSubjectStatusFilter('All');
                        setSubjectSortBy('code-asc');
                      }}
                      icon={RotateCcw}
                    >
                      Reset Search & Filters
                    </Button>
                  )}
                </div>
              ) : subjectViewMode === 'table' ? (
                /* Table View */
                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3 px-3.5">Subject & Code</th>
                        <th className="py-3 px-3">Semester</th>
                        <th className="py-3 px-3">Degree Program</th>
                        <th className="py-3 px-3">Type</th>
                        <th className="py-3 px-3">Credits</th>
                        <th className="py-3 px-3">Assigned Faculty</th>
                        <th className="py-3 px-3 text-center">Syllabus Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSubjects.map((sub) => {
                        const calculatedType = sub.isLab ? 'Lab' : sub.name?.toLowerCase().includes('project') ? 'Project' : 'Theory';
                        const assignedFacList = getSubjectAssignedFaculty(sub);
                        const timetableSlots = getSubjectTimetableSlots(sub);
                        return (
                          <tr key={sub._id || sub.id} className="hover:bg-amber-50/20 transition-colors">
                            <td className="py-3 px-3.5">
                              <div>
                                <span className="font-bold text-slate-900 block text-xs">{sub.name}</span>
                                <span className="font-mono text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[11px] inline-block mt-0.5">
                                  {sub.code}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700 font-medium">
                              Semester {sub.semester}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {sub.course?.name || sub.course?.code || 'Undergraduate'}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <Badge
                                variant={calculatedType === 'Lab' ? 'teal' : calculatedType === 'Project' ? 'navy' : 'amber'}
                                size="xs"
                              >
                                {calculatedType}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                {sub.credits} Credits
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {assignedFacList.length > 0 ? (
                                <div className="space-y-0.5">
                                  {assignedFacList.map((fac) => (
                                    <div key={fac.id} className="flex items-center space-x-1.5">
                                      <div className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                                        {fac.name.charAt(0)}
                                      </div>
                                      <span className="text-slate-800 font-medium truncate max-w-[140px]" title={fac.name}>
                                        {fac.name}
                                      </span>
                                    </div>
                                  ))}
                                  <span className="text-[10px] text-slate-400 block font-mono">
                                    {timetableSlots.length} weekly session{timetableSlots.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <Badge variant={sub.syllabusUrl ? 'teal' : 'neutral'} size="xs">
                                {sub.syllabusUrl ? 'Syllabus Attached' : 'Core Syllabus'}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => setSelectedSubjectDetails(sub)}
                                icon={Eye}
                              >
                                Details
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Cards / Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSubjects.map((sub) => {
                    const calculatedType = sub.isLab ? 'Lab' : sub.name?.toLowerCase().includes('project') ? 'Project' : 'Theory';
                    const assignedFacList = getSubjectAssignedFaculty(sub);
                    const timetableSlots = getSubjectTimetableSlots(sub);
                    return (
                      <div
                        key={sub._id || sub.id}
                        className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              {sub.code}
                            </span>
                            <div className="flex items-center space-x-1.5">
                              <Badge
                                variant={calculatedType === 'Lab' ? 'teal' : calculatedType === 'Project' ? 'navy' : 'amber'}
                                size="xs"
                              >
                                {calculatedType}
                              </Badge>
                              <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {sub.credits} Cr
                              </span>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 line-clamp-1" title={sub.name}>
                              {sub.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {sub.course?.name || sub.course?.code || 'Degree Course'} &bull; Semester {sub.semester}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Assigned Faculty:</span>
                            <span className="font-medium text-slate-800 truncate max-w-[150px]">
                              {assignedFacList.map((f) => f.name).join(', ') || 'Unassigned'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Weekly Classes:</span>
                            <span className="font-mono text-slate-700">
                              {timetableSlots.length} lecture / lab slots
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Syllabus Status:</span>
                            <Badge variant={sub.syllabusUrl ? 'teal' : 'neutral'} size="xs">
                              {sub.syllabusUrl ? 'Attached' : 'Core'}
                            </Badge>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-mono">
                            Sem {sub.semester} &bull; {calculatedType}
                          </span>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => setSelectedSubjectDetails(sub)}
                            icon={Eye}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Subject Details Modal */}
            {selectedSubjectDetails && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            selectedSubjectDetails.isLab
                              ? 'teal'
                              : selectedSubjectDetails.name?.toLowerCase().includes('project')
                              ? 'navy'
                              : 'amber'
                          }
                          size="xs"
                        >
                          {selectedSubjectDetails.isLab
                            ? 'Laboratory / Practical'
                            : selectedSubjectDetails.name?.toLowerCase().includes('project')
                            ? 'Project Work'
                            : 'Theory Lecture'}
                        </Badge>
                        <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          {selectedSubjectDetails.code}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {selectedSubjectDetails.credits} Credits
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-2">
                        {selectedSubjectDetails.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {selectedSubjectDetails.course?.name || selectedSubjectDetails.course?.code || 'Degree Course'} &bull; Semester {selectedSubjectDetails.semester}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedSubjectDetails(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                      title="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Academic Structure Meta */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">
                          {selectedSubjectDetails.department?.name || myDept?.name || 'Computer Science'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Course Term</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">
                          Semester {selectedSubjectDetails.semester}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Credit Units</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">
                          {selectedSubjectDetails.credits} Academic Credits
                        </p>
                      </div>
                    </div>

                    {/* Assigned Instructors & Faculty Correlation */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Assigned Faculty Instructors
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {getSubjectAssignedFaculty(selectedSubjectDetails).length} Instructor(s)
                        </span>
                      </div>

                      {(() => {
                        const facList = getSubjectAssignedFaculty(selectedSubjectDetails);
                        if (facList.length === 0) {
                          return (
                            <p className="text-xs text-amber-700 italic bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/50">
                              No faculty member is currently allocated to this subject in the department timetable.
                            </p>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            {facList.map((fac) => (
                              <div
                                key={fac.id}
                                className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    {fac.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 truncate">{fac.name}</p>
                                    <p className="text-[11px] text-slate-500 truncate">
                                      {fac.designation} {fac.employeeId ? `• ID: ${fac.employeeId}` : ''}
                                    </p>
                                    {fac.email && (
                                      <p className="text-[10px] text-slate-400 font-mono truncate">{fac.email}</p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => {
                                    const facName = fac.name;
                                    setSelectedSubjectDetails(null);
                                    handleTabChange('faculty');
                                    if (facName) setFacultySearch(facName);
                                  }}
                                >
                                  View in Roster
                                </Button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Weekly Timetable Schedule Slots */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Weekly Timetable Schedule
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {getSubjectTimetableSlots(selectedSubjectDetails).length} Active Slot(s)
                        </span>
                      </div>

                      {(() => {
                        const slots = getSubjectTimetableSlots(selectedSubjectDetails);
                        if (slots.length === 0) {
                          return (
                            <p className="text-xs text-slate-400 italic">
                              No weekly schedule slots allocated in master timetable yet.
                            </p>
                          );
                        }
                        return (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {slots.map((slot) => (
                              <div
                                key={slot._id || slot.id}
                                className="p-2 rounded-lg bg-white border border-slate-200/70 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-slate-800 capitalize">
                                    {slot.dayOfWeek} &bull; Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                                  </span>
                                  <span className="text-[11px] text-slate-500 block">
                                    Section {slot.section || 'A'} &bull; Room {slot.roomNumber || 'TBD'}
                                  </span>
                                </div>
                                <span className="text-[11px] font-medium text-slate-600">
                                  {slot.faculty?.user?.name || slot.faculty?.name || 'Staff'}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Syllabus Document & Curriculum Compliance */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Syllabus Documentation & Standards
                      </span>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">
                            {selectedSubjectDetails.syllabusUrl
                              ? 'Official Department Syllabus Attached'
                              : 'Core Curriculum Regulation Standard'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {selectedSubjectDetails.syllabusUrl
                              ? 'Verified syllabus file registered in academic records'
                              : 'Complies with AICTE / University standard core course syllabus'}
                          </p>
                        </div>
                        {selectedSubjectDetails.syllabusUrl ? (
                          <a
                            href={selectedSubjectDetails.syllabusUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Syllabus</span>
                          </a>
                        ) : (
                          <Badge variant="neutral" size="xs">
                            Standard Core
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedSubjectDetails(null)}
                    >
                      Close Details
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Academic Alerts & Department Compliance */}
        {isAlertsActive && (
          <div id="hod-alerts-section" className="space-y-4">
            {/* 1. Alerts KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Total Academic Alerts</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{totalAlertsCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Active department flags</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">High & Critical Priority</p>
                  <p className="text-xl font-bold text-rose-700 mt-0.5">{highPriorityAlertsCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Immediate intervention needed</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Pending Action</p>
                  <p className="text-xl font-bold text-amber-700 mt-0.5">{pendingAlertsCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Awaiting HOD review</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Acknowledged / Reviewed</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">{acknowledgedAlertsCount}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Reviewed by department head</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Error Banner with Retry */}
            {alertsFetchError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>Error loading academic alerts: {alertsFetchError}</span>
                </div>
                <Button variant="danger" size="xs" onClick={handleRefreshAlerts} icon={RotateCcw}>
                  Retry
                </Button>
              </div>
            )}

            {/* 2. Main Alerts Directory Card */}
            <Card
              title={`Academic Alerts & Department Compliance (${filteredDepartmentAlerts.length} of ${allDepartmentAlerts.length} Active Records)`}
              subtitle={`Real-time monitoring of attendance shortages, academic failure risks, unassigned schedule slots, and examination milestones`}
              action={
                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleRefreshAlerts}
                    icon={RefreshCw}
                    isLoading={isRefreshingAlerts}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleExportDepartmentAlerts}
                    icon={Download}
                    disabled={filteredDepartmentAlerts.length === 0}
                  >
                    Export (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => navigate('/attendance')}
                    icon={ExternalLink}
                  >
                    Attendance Register
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => navigate('/results')}
                    icon={ExternalLink}
                  >
                    Results Analysis
                  </Button>
                </div>
              }
            >
              {/* Filter Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 mb-4 pb-3 border-b border-navy-100">
                <div className="lg:col-span-2 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                  <input
                    type="text"
                    placeholder="Search by title, student, subject, faculty..."
                    value={alertsSearch}
                    onChange={(e) => setAlertsSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  {alertsSearch && (
                    <button
                      onClick={() => setAlertsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={alertsCategoryFilter}
                    onChange={(e) => setAlertsCategoryFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Categories</option>
                    {distinctAlertCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={alertsSeverityFilter}
                    onChange={(e) => setAlertsSeverityFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Critical">Critical Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <select
                    value={alertsStatusFilter}
                    onChange={(e) => setAlertsStatusFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="All">All Statuses</option>
                    <option value="pending">Pending Action</option>
                    <option value="acknowledged">Acknowledged / Reviewed</option>
                  </select>
                </div>

                <div>
                  <select
                    value={alertsSortBy}
                    onChange={(e) => setAlertsSortBy(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                  >
                    <option value="priority-desc">Sort: Priority (Critical First)</option>
                    <option value="priority-asc">Sort: Priority (Low to High)</option>
                    <option value="date-desc">Sort: Date (Newest First)</option>
                    <option value="date-asc">Sort: Date (Oldest First)</option>
                    <option value="title-asc">Sort: Title (A to Z)</option>
                  </select>
                </div>
              </div>

              {/* Data Rendering */}
              {isRefreshingAlerts ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-amber-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Reloading academic compliance records and alerts...</p>
                </div>
              ) : filteredDepartmentAlerts.length === 0 ? (
                allDepartmentAlerts.length === 0 ? (
                  <div className="py-10 text-center rounded-xl bg-emerald-50/50 border border-emerald-100 p-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2.5" />
                    <h3 className="text-sm font-bold text-emerald-950">Academic Health Standing: Compliant</h3>
                    <p className="text-xs text-emerald-800 mt-1 max-w-lg mx-auto leading-relaxed">
                      No active attendance shortages, failing marks, schedule clashes, or pending assessment deadlines detected across {myDept?.name || 'department'} records.
                    </p>
                  </div>
                ) : (
                  <div className="py-10 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-navy-500 font-medium">
                      No academic alerts matched your search "{alertsSearch}" or active filter criteria.
                    </p>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setAlertsSearch('');
                        setAlertsCategoryFilter('All');
                        setAlertsSeverityFilter('All');
                        setAlertsStatusFilter('All');
                        setAlertsSemesterFilter('All');
                        setAlertsSortBy('priority-desc');
                      }}
                      icon={RotateCcw}
                    >
                      Reset Search & Filters
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredDepartmentAlerts.map((alert) => {
                    const isAck = acknowledgedAlertIds.has(alert.id);
                    return (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-xl border transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
                          isAck
                            ? 'bg-slate-50/70 border-slate-200/70 opacity-80'
                            : alert.severity === 'Critical'
                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                            : alert.severity === 'High'
                            ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                            : 'bg-white border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={
                                alert.severity === 'Critical'
                                  ? 'danger'
                                  : alert.severity === 'High'
                                  ? 'amber'
                                  : alert.severity === 'Medium'
                                  ? 'teal'
                                  : 'neutral'
                              }
                              size="xs"
                            >
                              {alert.severity} Priority
                            </Badge>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {alert.category}
                            </span>
                            {alert.semester && alert.semester !== 'All Semesters' && (
                              <span className="text-slate-500 text-[11px] font-mono">
                                Sem {alert.semester} {alert.section && alert.section !== 'All Sections' ? `• Sec ${alert.section}` : ''}
                              </span>
                            )}
                            <Badge variant={isAck ? 'success' : 'neutral'} size="xs">
                              {isAck ? 'Acknowledged' : 'Pending Action'}
                            </Badge>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm">{alert.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                            <span className="font-medium text-slate-600">
                              Target: <span className="font-semibold text-slate-800">{alert.relatedEntity}</span>
                            </span>
                            <span>&bull;</span>
                            <span className="font-mono">
                              Detected: {new Date(alert.rawDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0 self-start md:self-center">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => setSelectedAlertDetails(alert)}
                            icon={Eye}
                          >
                            Details
                          </Button>
                          <Button
                            variant={isAck ? 'outline' : 'secondary'}
                            size="xs"
                            onClick={() => handleToggleAcknowledgeAlert(alert.id)}
                            icon={isAck ? RotateCcw : Check}
                          >
                            {isAck ? 'Reopen' : 'Acknowledge'}
                          </Button>
                          {alert.actionHandler && (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={alert.actionHandler}
                            >
                              {alert.actionLabel || 'Action'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Alert Details Modal */}
            {selectedAlertDetails && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            selectedAlertDetails.severity === 'Critical'
                              ? 'danger'
                              : selectedAlertDetails.severity === 'High'
                              ? 'amber'
                              : selectedAlertDetails.severity === 'Medium'
                              ? 'teal'
                              : 'neutral'
                          }
                          size="xs"
                        >
                          {selectedAlertDetails.severity} Priority
                        </Badge>
                        <Badge
                          variant={acknowledgedAlertIds.has(selectedAlertDetails.id) ? 'success' : 'neutral'}
                          size="xs"
                        >
                          {acknowledgedAlertIds.has(selectedAlertDetails.id) ? 'Acknowledged' : 'Pending Action'}
                        </Badge>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-2">
                        {selectedAlertDetails.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Category: {selectedAlertDetails.category}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedAlertDetails(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                      title="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Metadata Grid */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Related Record</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">
                          {selectedAlertDetails.relatedEntity}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Term</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">
                          Semester {selectedAlertDetails.semester || 'All'} {selectedAlertDetails.section ? `• Sec ${selectedAlertDetails.section}` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Date Detected</span>
                        <p className="font-mono text-slate-700 text-xs mt-0.5">
                          {new Date(selectedAlertDetails.rawDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Department Scope</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">
                          {myDept?.name || 'Computer Science & Engineering'}
                        </p>
                      </div>
                    </div>

                    {/* Detailed Reason and Context */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Alert Description & Findings
                      </span>
                      <p className="text-slate-700 leading-relaxed">
                        {selectedAlertDetails.description}
                      </p>
                    </div>

                    {/* Recommended Administrative Action */}
                    <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 space-y-1.5 text-amber-900">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">
                        Recommended HOD Action
                      </span>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        {selectedAlertDetails.category === 'Attendance Shortage'
                          ? 'Review student attendance register, notify parent/guardian, and arrange mandatory counseling before end-semester exam registration.'
                          : selectedAlertDetails.category === 'Academic Risk'
                          ? 'Review remedial class schedule, consult with subject teacher, and track internal assessment progress.'
                          : selectedAlertDetails.category === 'Attendance Register'
                          ? 'Ensure assigned faculty marks class attendance daily in compliance with institutional guidelines.'
                          : selectedAlertDetails.category === 'Timetable Allocation'
                          ? 'Resolve room clashing or assign teaching staff to unallocated master periods in timetable.'
                          : 'Review timeline and ensure departmental compliance with college administration.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <Button
                      variant={acknowledgedAlertIds.has(selectedAlertDetails.id) ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        handleToggleAcknowledgeAlert(selectedAlertDetails.id);
                        setSelectedAlertDetails(null);
                      }}
                      icon={acknowledgedAlertIds.has(selectedAlertDetails.id) ? RotateCcw : Check}
                    >
                      {acknowledgedAlertIds.has(selectedAlertDetails.id) ? 'Reopen Alert' : 'Mark as Acknowledged'}
                    </Button>

                    <div className="flex items-center space-x-2">
                      {selectedAlertDetails.actionHandler && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const handler = selectedAlertDetails.actionHandler;
                            setSelectedAlertDetails(null);
                            handler();
                          }}
                        >
                          {selectedAlertDetails.actionLabel}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedAlertDetails(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: SUPER ADMIN / PRINCIPAL HOD ROSTER MANAGEMENT
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-navy-900 rounded-2xl p-6 text-white shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-teal-500/30">
            <Users className="w-3.5 h-3.5 mr-1" />
            <span>Head of Department Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Academic Department Governance & HOD Roster</h1>
          <p className="mt-1 text-xs sm:text-sm text-navy-200 font-light">
            Manage department assignments, prevent conflicting duplicate HOD allotments, and oversee curriculum workload.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="teal"
            size="md"
            onClick={() => setIsCreateHodOpen(true)}
            icon={UserPlus}
            className="shadow-elevation"
          >
            Provision HOD Account
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={loadData}
            icon={RefreshCw}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Vacancy Warning Banner if any department lacks an HOD */}
      {unassignedDepts.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-3 text-xs sm:text-sm shadow-subtle">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-amber-950">
              Department Leadership Alert: {unassignedDepts.length} Department(s) Without an Assigned HOD
            </h4>
            <p className="mt-0.5 text-amber-800 text-xs font-light">
              The following engineering units have no designated Head of Department:{' '}
              <span className="font-semibold">{unassignedDepts.map((d) => d.name).join(', ')}</span>. Please assign qualified faculty or HOD accounts below.
            </p>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatWidget
          title="Departments Configured"
          value={`${departments.length} Units`}
          subtitle="All B.Tech Programs"
          icon={Building2}
          color="navy"
        />
        <StatWidget
          title="Assigned HODs"
          value={`${departments.filter((d) => d.hasHod).length} / ${departments.length}`}
          subtitle={`${unassignedDepts.length} Vacant Position(s)`}
          icon={Users}
          color="teal"
        />
        <StatWidget
          title="Registered HOD Accounts"
          value={`${hodUsers.length} Officers`}
          subtitle={`${hodUsers.filter((u) => u.status === USER_STATUS.ACTIVE).length} Active in System`}
          icon={BookOpen}
          color="emerald"
        />
        <StatWidget
          title="Syllabus Subjects"
          value={`${subjects.length} Courses`}
          subtitle="Curriculum Progression"
          icon={Layers}
          color="amber"
        />
      </div>

      {/* 1. Department Assignment & Vacancies Table */}
      <Card
        title="Department HOD Assignment & Enrollment Summaries"
        subtitle="Ensure every academic unit has a designated Head of Department without conflicting duplicate assignments"
      >
        <Table
          columns={deptColumns}
          data={departments}
          keyField="id"
          isLoading={isLoading}
          emptyMessage="No departments configured in the database."
        />
      </Card>

      {/* 2. HOD Directory & Account Administration */}
      <Card
        title="HOD Officer Directory & Governance"
        subtitle="Manage HOD credentials, profile editing, and password reset initiation"
        headerAction={
          <Button
            variant="teal"
            size="xs"
            onClick={() => setIsCreateHodOpen(true)}
            icon={UserPlus}
          >
            New HOD User
          </Button>
        }
      >
        <Table
          columns={hodColumns}
          data={hodUsers}
          keyField="_id"
          isLoading={isLoading}
          emptyMessage="No HOD accounts registered."
        />
      </Card>

      {/* 3. Academic Operation & Workload Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Department Curriculum & Workload Summary"
          subtitle="Active subjects mapped to departments"
        >
          {subjects.length === 0 ? (
            <p className="text-xs text-navy-400 py-6 text-center">No syllabus courses found.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {subjects.slice(0, 8).map((sub) => (
                <div key={sub._id} className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-navy-900 block">{sub.name}</span>
                    <span className="text-[11px] text-navy-500 font-mono">
                      Code: {sub.code} &bull; Semester {sub.semester}
                    </span>
                  </div>
                  <Badge variant="teal" size="xs">
                    {sub.credits} Credits
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Master Timetable Scheduled Slots"
          subtitle="Weekly periods allocated across rooms & venues"
        >
          {timetableSlots.length === 0 ? (
            <p className="text-xs text-navy-400 py-6 text-center">No class timetable slots populated yet.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {timetableSlots.slice(0, 8).map((slot) => (
                <div key={slot._id} className="p-3 rounded-xl bg-white border border-navy-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-navy-900 block">
                      {slot.subject?.name || 'Class Session'}
                    </span>
                    <span className="text-[11px] text-navy-500 font-mono">
                      {slot.dayOfWeek} &bull; Period {slot.periodNumber} &bull; Room: {slot.roomNumber || 'Room 302'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-navy-600 bg-navy-50 px-2 py-0.5 rounded border border-navy-100">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modal 1: Assign / Reassign HOD */}
      <Modal
        isOpen={isAssignHodOpen}
        onClose={() => setIsAssignHodOpen(false)}
        title={`Assign Head of Department: ${selectedDept?.name || ''}`}
        subtitle="Select a qualified faculty member or HOD account. Conflicting double assignments will be rejected by the backend."
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsAssignHodOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="teal" size="sm" onClick={handleAssignSubmit} isLoading={isSubmitting}>
              Confirm Assignment
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <div>
            <label className="block text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1.5">
              Select Designated HOD <span className="text-rose-500">*</span>
            </label>
            <Select
              id="select-hod"
              value={assignForm.hodUserId}
              onChange={(e) => setAssignForm({ hodUserId: e.target.value })}
              options={[
                { value: '', label: '— Unassign / Leave Vacant —' },
                ...hodUsers.map((h) => ({
                  value: h._id,
                  label: `${h.name} (${h.email}) - Current: ${h.department || 'Unassigned'}`
                }))
              ]}
            />
          </div>
          <p className="text-[11px] text-navy-500">
            Enforces institutional rule: An HOD cannot be concurrently assigned to more than one academic department.
          </p>
        </form>
      </Modal>

      {/* Modal 2: Provision HOD Account */}
      <Modal
        isOpen={isCreateHodOpen}
        onClose={() => setIsCreateHodOpen(false)}
        title="Provision New HOD Account"
        subtitle="Creates an institutional account with role 'HOD' and bcrypt password hashing"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsCreateHodOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="teal" size="sm" onClick={handleCreateHodSubmit} isLoading={isSubmitting}>
              Create HOD Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateHodSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <Input
            label="Full Name"
            id="hod-name"
            required
            value={createHodForm.name}
            onChange={(e) => setCreateHodForm({ ...createHodForm, name: e.target.value })}
            placeholder="e.g. Prof. David Kumar"
          />

          <Input
            label="Institutional Email"
            id="hod-email"
            type="email"
            required
            value={createHodForm.email}
            onChange={(e) => setCreateHodForm({ ...createHodForm, email: e.target.value })}
            placeholder="e.g. hod.cse@college.edu"
          />

          <Input
            label="Confidential Password"
            id="hod-pass"
            type="password"
            required
            value={createHodForm.password}
            onChange={(e) => setCreateHodForm({ ...createHodForm, password: e.target.value })}
            placeholder="At least 6 characters"
          />

          <Select
            label="Department Assignment"
            id="hod-dept"
            value={createHodForm.department}
            onChange={(e) => setCreateHodForm({ ...createHodForm, department: e.target.value })}
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          />
        </form>
      </Modal>

      {/* Modal 3: Reset Password */}
      <Modal
        isOpen={isResetPassOpen}
        onClose={() => setIsResetPassOpen(false)}
        title={`Reset Password for ${selectedHodUser?.name || 'HOD'}`}
        subtitle={`Set a new temporary password for ${selectedHodUser?.email || ''}`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsResetPassOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleResetPassSubmit} isLoading={isSubmitting} icon={Key}>
              Apply New Password
            </Button>
          </>
        }
      >
        <form onSubmit={handleResetPassSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <Input
            label="New Confidential Password"
            id="reset-hod-pass"
            type="password"
            required
            value={newPasswordVal}
            onChange={(e) => setNewPasswordVal(e.target.value)}
            placeholder="At least 6 characters"
          />
        </form>
      </Modal>

      {/* Faculty Detail View Modal */}
      {selectedFacultyDetails && (
        <Modal
          isOpen={!!selectedFacultyDetails}
          onClose={() => setSelectedFacultyDetails(null)}
          title={`Faculty Profile: ${selectedFacultyDetails.user?.name || 'Faculty Member'}`}
          subtitle={`Employee Record • ID: ${selectedFacultyDetails.employeeId || '—'}`}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-slate-400">
                Authorized Department Member • {myDept?.name || 'Computer Science & Engineering'}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setSelectedFacultyDetails(null)}>
                Close Profile
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-start justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm">
                  {selectedFacultyDetails.user?.name
                    ? selectedFacultyDetails.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                    : 'FA'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{selectedFacultyDetails.user?.name || 'Faculty Member'}</h4>
                  <p className="text-xs text-slate-500 font-mono">{selectedFacultyDetails.user?.email || '—'}</p>
                  <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                    {selectedFacultyDetails.designation || 'Faculty'} • Department of {myDept?.name || 'Engineering'}
                  </p>
                </div>
              </div>
              <Badge variant={selectedFacultyDetails.user?.status === 'active' || !selectedFacultyDetails.user?.status ? 'success' : 'neutral'} size="sm">
                {selectedFacultyDetails.user?.status || 'Active'}
              </Badge>
            </div>

            {/* Credentials Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Highest Qualification</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  {selectedFacultyDetails.qualification || 'M.Tech / Ph.D. in Computer Science'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Area of Specialization</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  {selectedFacultyDetails.specialization || 'Software Systems & Distributed Computing'}
                </span>
              </div>
            </div>

            {/* Assigned Subjects */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Assigned Curriculum Subjects
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {getFacultyAssignedSubjects(selectedFacultyDetails).length} Subjects
                </span>
              </div>
              {getFacultyAssignedSubjects(selectedFacultyDetails).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No curriculum subjects currently allocated.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getFacultyAssignedSubjects(selectedFacultyDetails).map((sub, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-indigo-950 block">{sub.name}</span>
                        <span className="text-[10px] text-indigo-600 font-mono">{sub.code || 'Curriculum'}</span>
                      </div>
                      {sub.semester && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white text-indigo-700 border border-indigo-200">
                          Sem {sub.semester}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Timetable Slots & Teaching Load */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Teaching Timetable & Schedule ({getFacultyTimetableSlots(selectedFacultyDetails).length} Weekly Slots)
                </span>
                <span className="text-[11px] text-amber-700 font-semibold">
                  {getFacultyTimetableSlots(selectedFacultyDetails).length} Hours/Week
                </span>
              </div>
              {getFacultyTimetableSlots(selectedFacultyDetails).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No active timetable sessions recorded for this faculty member.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {getFacultyTimetableSlots(selectedFacultyDetails).map((slot, sIdx) => (
                    <div
                      key={sIdx}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                          {slot.dayOfWeek}
                        </span>
                        <span className="font-semibold text-slate-800">
                          Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">Sec {slot.section || 'A'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-700 font-medium">{slot.subject?.name || 'Class'}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white text-slate-700 border border-slate-200">
                          {slot.roomNumber || 'Room TBD'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Student Details Modal */}
      {selectedStudentDetails && (
        <Modal
          isOpen={!!selectedStudentDetails}
          onClose={() => setSelectedStudentDetails(null)}
          title="Student Cohort Profile & Academic Scope"
          subtitle={`Authorized department undergraduate profile • ${selectedStudentDetails.rollNumber}`}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-slate-400">
                Department of {myDept?.name || 'Computer Science & Engineering'}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedStudentDetails(null);
                    navigate('/attendance');
                  }}
                  icon={ExternalLink}
                >
                  Attendance Register
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedStudentDetails(null);
                    navigate('/results');
                  }}
                  icon={ExternalLink}
                >
                  Results Analysis
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedStudentDetails(null)}>
                  Close Profile
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-start justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-sm">
                  {selectedStudentDetails.user?.name
                    ? selectedStudentDetails.user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                    : 'ST'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{selectedStudentDetails.user?.name || 'Student'}</h4>
                  <p className="text-xs text-slate-500 font-mono">{selectedStudentDetails.user?.email || '—'}</p>
                  <p className="text-[11px] text-teal-700 font-semibold mt-0.5">
                    Roll: {selectedStudentDetails.rollNumber}
                    {selectedStudentDetails.enrollmentNumber && ` • Enr: ${selectedStudentDetails.enrollmentNumber}`}
                    {` • Sem ${selectedStudentDetails.currentSemester}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge
                  variant={
                    (selectedStudentDetails.admissionStatus || 'enrolled').toLowerCase() === 'enrolled'
                      ? 'success'
                      : selectedStudentDetails.admissionStatus === 'suspended'
                      ? 'danger'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {selectedStudentDetails.admissionStatus || 'Enrolled'}
                </Badge>
                <span className="text-[10px] text-slate-400 font-mono">
                  Account: {selectedStudentDetails.user?.status || 'Active'}
                </span>
              </div>
            </div>

            {/* Academic Scope Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Department</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                  {selectedStudentDetails.department?.name || myDept?.name || 'Computer Science'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Course / Program</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                  {selectedStudentDetails.course?.name || selectedStudentDetails.course?.code || 'B.Tech CSE'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Semester</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  Semester {selectedStudentDetails.currentSemester}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Academic Batch</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  {selectedStudentDetails.batchYear || '—'}
                </span>
              </div>
            </div>

            {/* Contact & Guardian Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
                <span className="text-xs font-bold text-slate-900 block">Contact & Identity</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Email:</span>
                    <a href={`mailto:${selectedStudentDetails.user?.email}`} className="text-teal-700 font-medium hover:underline">
                      {selectedStudentDetails.user?.email || '—'}
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Blood Group:</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetails.bloodGroup || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Last System Login:</span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {selectedStudentDetails.user?.lastLogin ? new Date(selectedStudentDetails.user.lastLogin).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
                <span className="text-xs font-bold text-slate-900 block">Guardian Details</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Guardian Name:</span>
                    <span className="font-medium text-slate-800">{selectedStudentDetails.guardianName || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Guardian Contact:</span>
                    <span className="font-mono text-slate-700">{selectedStudentDetails.guardianPhone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Section Scope:</span>
                    <span className="text-slate-700 font-medium">Undergraduate Section {selectedStudentDetails.section || 'A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Summary */}
            {(() => {
              const studId = selectedStudentDetails._id || selectedStudentDetails.id;
              const studRoll = selectedStudentDetails.rollNumber;
              const studAttRecords = attendanceRecords.filter(
                (att) =>
                  (att.student?._id && String(att.student._id) === String(studId)) ||
                  (att.student?.rollNumber && att.student.rollNumber === studRoll) ||
                  (att.student && String(att.student) === String(studId))
              );
              const presentCount = studAttRecords.filter((a) => a.status === 'present' || a.status === 'late').length;
              const attPct = studAttRecords.length > 0 ? Number(((presentCount / studAttRecords.length) * 100).toFixed(1)) : null;

              return (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CalendarCheck className="w-4 h-4 text-emerald-600" />
                      Attendance Register Summary
                    </span>
                    <div className="flex items-center gap-2">
                      {attPct !== null ? (
                        <Badge variant={attPct >= 75 ? 'success' : 'danger'} size="xs">
                          {attPct}% Attendance
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="xs">No Records</Badge>
                      )}
                    </div>
                  </div>
                  {studAttRecords.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No attendance records logged for this student in current semester.</p>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                        <span>Attended {presentCount} of {studAttRecords.length} recorded class sessions</span>
                        <span className="font-bold">{attPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            attPct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, attPct || 0)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Academic Results Summary */}
            {(() => {
              const studId = selectedStudentDetails._id || selectedStudentDetails.id;
              const studRoll = selectedStudentDetails.rollNumber;
              const studResults = resultsList.filter(
                (res) =>
                  (res.student?._id && String(res.student._id) === String(studId)) ||
                  (res.student?.rollNumber && res.student.rollNumber === studRoll) ||
                  (res.student && String(res.student) === String(studId))
              );

              return (
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-600" />
                      Academic Performance & Examination Results ({studResults.length} Records)
                    </span>
                  </div>
                  {studResults.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No examination results or internal assessment grades submitted yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {studResults.map((res, rIdx) => (
                        <div key={rIdx} className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{res.subject?.name || res.examination?.name || 'Assessment'}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Code: {res.subject?.code || '—'} &bull; Sem {res.examination?.semester || selectedStudentDetails.currentSemester}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800">
                              {res.totalMarks !== undefined ? `${res.totalMarks} Marks` : `${res.internalMarks || 0} Int`}
                            </span>
                            <Badge variant={res.status === 'failed' ? 'danger' : 'success'} size="xs">
                              {res.grade || res.status || 'Graded'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* Confirm Dialog: Activate / Disable */}
      <ConfirmDialog
        isOpen={!!confirmToggleHod}
        onClose={() => setConfirmToggleHod(null)}
        onConfirm={handleConfirmToggleHod}
        title={confirmToggleHod?.status === USER_STATUS.ACTIVE ? 'Disable HOD Account?' : 'Activate HOD Account?'}
        message={
          confirmToggleHod?.status === USER_STATUS.ACTIVE
            ? `Disabling account '${confirmToggleHod?.email}' will prevent them from approving marks, verifying timetables, and accessing HOD dashboards.`
            : `Activating account '${confirmToggleHod?.email}' will restore their access.`
        }
        confirmText={confirmToggleHod?.status === USER_STATUS.ACTIVE ? 'Disable Account' : 'Activate Account'}
        isDanger={confirmToggleHod?.status === USER_STATUS.ACTIVE}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default HodDashboard;
