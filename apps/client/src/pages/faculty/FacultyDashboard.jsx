import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  Award,
  BookOpen,
  Clock,
  CheckCircle,
  Users,
  Search,
  UserPlus,
  RefreshCw,
  Edit2,
  Key,
  UserCheck,
  UserX,
  Mail,
  Building2,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Calendar,
  Bell,
  Percent,
  Download,
  Filter,
  Plus,
  Trash2,
  Eye,
  BarChart2,
  User
} from 'lucide-react';
import Card from '../../components/common/Card';
import CampusBuildingGraphic from '../../components/common/CampusBuildingGraphic';
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

import AssignmentsSection from './components/AssignmentsSection';
import SyllabusMaterialsSection from './components/SyllabusMaterialsSection';
import AttendanceAnalyticsSection from './components/AttendanceAnalyticsSection';
import FacultyProfileModal from './components/FacultyProfileModal';
import FacultyNotificationsCenter from './components/FacultyNotificationsCenter';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSec = Math.floor((now - date) / 1000);
  if (diffInSec < 60) return 'Just now';
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return `${diffInMin}m ago`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActivityDisplay(act) {
  const action = act.action || '';
  if (action === 'ATTENDANCE_MARKED') {
    const period = act.details?.periodNumber ? `Period ${act.details.periodNumber}` : 'session';
    const count = act.details?.count ? `(${act.details.count} students)` : '';
    return {
      title: `Attendance marked for ${period} ${count}`.trim(),
      icon: CalendarCheck,
      color: 'text-purple-600 bg-purple-50'
    };
  }
  if (action === 'MARKS_RECORDED') {
    const count = act.details?.count ? `(${act.details.count} students)` : '';
    return {
      title: `Evaluation marks submitted ${count}`.trim(),
      icon: Award,
      color: 'text-emerald-600 bg-emerald-50'
    };
  }
  if (action.includes('LOGIN')) {
    return {
      title: 'Portal login session',
      icon: Key,
      color: 'text-blue-600 bg-blue-50'
    };
  }
  return {
    title: act.entityType ? `${act.action} on ${act.entityType}` : (act.action || 'Faculty activity'),
    icon: FileText,
    color: 'text-slate-600 bg-slate-50'
  };
}

const VALID_FACULTY_TABS = ['timetable', 'courses', 'roster', 'exams', 'assignments', 'analytics'];

export const FacultyDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [facultyList, setFacultyList] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetableSlots, setTimetableSlots] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [activities, setActivities] = useState([]);
  const [notices, setNotices] = useState([]);
  const [results, setResults] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const facultyActiveTab = VALID_FACULTY_TABS.includes(queryTab) ? queryTab : 'timetable';

  const handleTabChange = useCallback((newTab) => {
    if (VALID_FACULTY_TABS.includes(newTab)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', newTab);
        return next;
      });
    }
  }, [setSearchParams]);

  const [isMarkAttendanceOpen, setIsMarkAttendanceOpen] = useState(false);

  // Filters
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedDesigFilter, setSelectedDesigFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);

  // Forms
  const [editForm, setEditForm] = useState({
    designation: 'Assistant Professor',
    department: '',
    qualification: '',
    specialization: ''
  });

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    employeeId: '',
    departmentId: '',
    designation: 'Assistant Professor',
    qualification: 'M.Tech in Engineering',
    specialization: ''
  });

  const [attendanceForm, setAttendanceForm] = useState({
    subject: '',
    date: new Date().toISOString().split('T')[0],
    periodNumber: 1,
    status: 'present',
    studentId: '',
    remarks: 'Regular period lecture'
  });

  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFacultyRole = user?.role === ROLES.FACULTY;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isFacultyRole) {
        const [myProfRes, subjRes, timeRes, studRes, examRes, attRes, actRes, notRes, resRes, assignRes, matRes] = await Promise.all([
          api.getMyFacultyProfile().catch(() => ({ data: null })),
          api.getSubjects().catch(() => ({ data: [] })),
          api.getTimetable().catch(() => ({ data: [] })),
          api.getStudents({ limit: 500 }).catch(() => ({ data: [] })),
          api.getExams().catch(() => ({ data: [] })),
          api.getAttendance().catch(() => ({ data: [] })),
          api.getMyFacultyActivities().catch(() => ({ data: [] })),
          api.getNotices().catch(() => ({ data: [] })),
          api.getResults().catch(() => ({ data: [] })),
          api.getAssignments().catch(() => ({ data: [] })),
          api.getMaterials().catch(() => ({ data: [] }))
        ]);

        if (myProfRes?.data) setMyProfile(myProfRes.data);
        if (subjRes?.data) setSubjects(subjRes.data);
        if (timeRes?.data) setTimetableSlots(timeRes.data);
        if (studRes?.data) setStudents(studRes.data);
        if (examRes?.data) setExams(Array.isArray(examRes.data) ? examRes.data : (examRes.data?.exams || []));
        if (attRes?.data) setAttendanceRecords(attRes.data);
        if (actRes?.data) setActivities(Array.isArray(actRes.data) ? actRes.data : []);
        if (notRes?.data) setNotices(Array.isArray(notRes.data) ? notRes.data : []);
        if (resRes?.data) setResults(Array.isArray(resRes.data) ? resRes.data : []);
        if (assignRes?.data) setAssignments(Array.isArray(assignRes.data) ? assignRes.data : []);
        if (matRes?.data) setMaterials(Array.isArray(matRes.data) ? matRes.data : []);
      } else {
        const [facRes, subjRes, timeRes, deptRes, usersRes] = await Promise.all([
          api.getFaculty({
            department: selectedDeptFilter,
            designation: selectedDesigFilter
          }).catch(() => ({ data: [] })),
          api.getSubjects().catch(() => ({ data: [] })),
          api.getTimetable().catch(() => ({ data: [] })),
          api.getDepartments().catch(() => ({ data: [] })),
          api.getUsers({ role: ROLES.FACULTY, limit: 100 }).catch(() => ({ data: [] }))
        ]);

        if (facRes?.data) setFacultyList(facRes.data);
        if (subjRes?.data) setSubjects(subjRes.data);
        if (timeRes?.data) setTimetableSlots(timeRes.data);
        if (deptRes?.data) setDepartments(deptRes.data);
        if (usersRes?.data) setAllUsers(usersRes.data);
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error loading faculty workplace',
        message: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [isFacultyRole, selectedDeptFilter, selectedDesigFilter, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Assignment Handlers
  const handleCreateAssignment = async (formData) => {
    const res = await api.createAssignment(formData);
    addToast({
      type: 'success',
      title: 'Assignment Created',
      message: `Assignment "${formData.title}" created successfully.`
    });
    const updated = await api.getAssignments();
    if (updated?.data) setAssignments(Array.isArray(updated.data) ? updated.data : []);
    return res;
  };

  const handleUpdateAssignment = async (id, formData) => {
    const res = await api.updateAssignment(id, formData);
    addToast({
      type: 'success',
      title: 'Assignment Updated',
      message: `Assignment "${formData.title}" updated successfully.`
    });
    const updated = await api.getAssignments();
    if (updated?.data) setAssignments(Array.isArray(updated.data) ? updated.data : []);
    return res;
  };

  const handleDeleteAssignment = async (id) => {
    await api.deleteAssignment(id);
    addToast({
      type: 'success',
      title: 'Assignment Removed',
      message: 'Assignment removed successfully.'
    });
    const updated = await api.getAssignments();
    if (updated?.data) setAssignments(Array.isArray(updated.data) ? updated.data : []);
  };

  const handlePublishAssignment = async (id) => {
    await api.publishAssignment(id);
    addToast({
      type: 'success',
      title: 'Assignment Published',
      message: 'Assignment is now published and active for students.'
    });
    const updated = await api.getAssignments();
    if (updated?.data) setAssignments(Array.isArray(updated.data) ? updated.data : []);
  };

  const handleEvaluateSubmission = async (assignmentId, submissionId, data) => {
    const res = await api.evaluateAssignmentSubmission(assignmentId, submissionId, data);
    addToast({
      type: 'success',
      title: 'Submission Evaluated',
      message: `Grade (${data.marksObtained} marks) and feedback saved.`
    });
    const updated = await api.getAssignments();
    if (updated?.data) setAssignments(Array.isArray(updated.data) ? updated.data : []);
    return res;
  };

  const handleRefreshMaterials = async () => {
    const res = await api.getMaterials();
    if (res?.data) setMaterials(Array.isArray(res.data) ? res.data : []);
  };

  // Open Edit Profile
  const handleOpenEdit = (fac) => {
    setSelectedFaculty(fac);
    setEditForm({
      designation: fac.designation || 'Assistant Professor',
      department: fac.department?._id || fac.department?.id || '',
      qualification: fac.qualification || '',
      specialization: fac.specialization || ''
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setFormError('');

    setIsSubmitting(true);
    try {
      await api.updateFaculty(selectedFaculty._id || selectedFaculty.id, editForm);
      addToast({
        type: 'success',
        title: 'Faculty Profile Updated',
        message: `Updated profile details for employee ${selectedFaculty.employeeId}`
      });
      setIsEditOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to update faculty profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Create Faculty
  const handleOpenCreate = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      employeeId: `FAC-${Date.now().toString().slice(-4)}`,
      departmentId: departments[0]?._id || '',
      designation: 'Assistant Professor',
      qualification: 'M.Tech / Ph.D.',
      specialization: 'Computer Systems'
    });
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!createForm.name || !createForm.email || !createForm.password || !createForm.employeeId) {
      setFormError('Please fill in all mandatory fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create or ensure user account
      const userRes = await api.createUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: ROLES.FACULTY,
        department: departments.find((d) => d._id === createForm.departmentId)?.name || 'Engineering',
        status: USER_STATUS.ACTIVE
      });

      const newUserId = userRes.data?.id || userRes.data?._id;

      // 2. Create faculty record
      await api.createFaculty({
        user: newUserId,
        employeeId: createForm.employeeId,
        department: createForm.departmentId || departments[0]?._id,
        designation: createForm.designation,
        qualification: createForm.qualification,
        specialization: createForm.specialization
      });

      addToast({
        type: 'success',
        title: 'Faculty Provisioned',
        message: `Created faculty account & employee profile for ${createForm.email}`
      });
      setIsCreateOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to provision faculty profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Password
  const handleResetPassSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFaculty?.user?._id) return;
    if (!newPasswordVal || newPasswordVal.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.resetUserPassword(selectedFaculty.user._id, newPasswordVal);
      addToast({
        type: 'success',
        title: 'Password Reset',
        message: `Temporary password assigned to ${selectedFaculty.user.email}`
      });
      setIsResetOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status
  const handleConfirmToggle = async () => {
    if (!confirmToggleUser?.user?._id) return;
    const currentStatus = confirmToggleUser.user.status;
    const newStatus = currentStatus === USER_STATUS.ACTIVE ? USER_STATUS.DISABLED : USER_STATUS.ACTIVE;

    setIsSubmitting(true);
    try {
      await api.updateUserStatus(confirmToggleUser.user._id, newStatus);
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: `Faculty user ${confirmToggleUser.user.email} is now ${newStatus}.`
      });
      setConfirmToggleUser(null);
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

  // Submit Attendance Session
  const handleMarkAttendanceSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!attendanceForm.subject || !attendanceForm.studentId) {
      setFormError('Please select both a subject and a student.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.markAttendanceBatch({
        subject: attendanceForm.subject,
        date: attendanceForm.date,
        periodNumber: Number(attendanceForm.periodNumber),
        records: [
          {
            studentId: attendanceForm.studentId,
            status: attendanceForm.status,
            remarks: attendanceForm.remarks
          }
        ]
      });
      addToast({
        type: 'success',
        title: 'Attendance Session Recorded',
        message: 'Student session attendance persisted to MongoDB.'
      });
      setIsMarkAttendanceOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to submit attendance session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Faculty List by Search
  const filteredFaculty = facultyList.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.employeeId?.toLowerCase().includes(q) ||
      f.user?.name?.toLowerCase().includes(q) ||
      f.user?.email?.toLowerCase().includes(q) ||
      f.specialization?.toLowerCase().includes(q)
    );
  });

  // Columns for Faculty Directory Table
  const facultyColumns = [
    {
      header: 'Employee ID & Details',
      cell: (row) => (
        <div>
          <span className="font-semibold text-navy-950 text-sm block">
            {row.user?.name || 'Faculty Member'}
          </span>
          <span className="text-xs text-teal-800 font-mono font-bold">
            {row.employeeId}
          </span>
        </div>
      )
    },
    {
      header: 'Department',
      cell: (row) => (
        <span className="text-xs text-navy-800 font-medium">
          {row.department?.name || 'â€”'}
        </span>
      )
    },
    {
      header: 'Designation',
      cell: (row) => (
        <Badge variant="teal" size="xs">
          {row.designation}
        </Badge>
      )
    },
    {
      header: 'Specialization & Degree',
      cell: (row) => (
        <div>
          <span className="text-xs text-navy-900 block">{row.specialization || 'Engineering'}</span>
          <span className="text-[11px] text-navy-500 font-light">{row.qualification || 'M.Tech'}</span>
        </div>
      )
    },
    {
      header: 'Status',
      cell: (row) => {
        const isActive = row.user?.status === USER_STATUS.ACTIVE;
        return (
          <span className="inline-flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className={`text-xs font-semibold capitalize ${isActive ? 'text-emerald-700' : 'text-rose-700'}`}>
              {row.user?.status || 'Active'}
            </span>
          </span>
        );
      }
    },
    {
      header: 'Actions',
      cellClassName: 'text-right',
      cell: (row) => {
        const isActive = row.user?.status === USER_STATUS.ACTIVE;
        return (
          <div className="flex items-center justify-end space-x-1.5">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => handleOpenEdit(row)}
              icon={Edit2}
              title="Edit Profile"
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                setSelectedFaculty(row);
                setNewPasswordVal('');
                setFormError('');
                setIsResetOpen(true);
              }}
              icon={Key}
              title="Reset Password"
            >
              Reset Pass
            </Button>
            <Button
              variant={isActive ? 'danger' : 'secondary'}
              size="xs"
              onClick={() => setConfirmToggleUser(row)}
              icon={isActive ? UserX : UserCheck}
            >
              {isActive ? 'Disable' : 'Activate'}
            </Button>
          </div>
        );
      }
    }
  ];

  // ==========================================
  // VIEW 1: AUTHENTICATED FACULTY SELF-SERVICE WORKPLACE
  // ==========================================
  // States for interactive faculty features
  const [attendanceSubjectId, setAttendanceSubjectId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendancePeriod, setAttendancePeriod] = useState('1');
  const [attendanceRemarks, setAttendanceRemarks] = useState('');
  const [studentRoster, setStudentRoster] = useState([]);

  // Roster tab filters & pagination
  const [rosterSubjectFilter, setRosterSubjectFilter] = useState('all');
  const [rosterSemesterFilter, setRosterSemesterFilter] = useState('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(1);
  const ROSTER_PAGE_SIZE = 10;

  // Exams tab state & marks modal
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState('');
  const [isMarksModalOpen, setIsMarksModalOpen] = useState(false);
  const [marksRoster, setMarksRoster] = useState([]);
  const [marksFormError, setMarksFormError] = useState('');

  if (isFacultyRole) {
    const facultyUser = myProfile || facultyList.find((f) => f.user?._id === user?._id || f.user?.id === user?._id);
    const myDeptName = facultyUser?.department?.name || user?.department || 'Engineering';
    const myFacultyDocId = facultyUser?._id || facultyUser?.id;
    const myUserId = user?._id || user?.id;

    // Resolve timetable slots assigned to authenticated faculty
    const mySlots = timetableSlots.filter((slot) => {
      if (!slot) return false;
      const fac = slot.faculty;
      if (!fac) return false;
      if (myFacultyDocId && (fac === myFacultyDocId || fac._id === myFacultyDocId || fac.id === myFacultyDocId)) return true;
      if (myUserId && (fac.user === myUserId || fac.user?._id === myUserId || fac.user?.id === myUserId)) return true;
      if (typeof fac === 'string' && (fac === myFacultyDocId || fac === myUserId)) return true;
      if (facultyUser?.employeeId && fac.employeeId === facultyUser.employeeId) return true;
      if (user?.email && (fac.user?.email === user.email || fac.email === user.email)) return true;
      return false;
    });

    // Derive unique curriculum subjects allocated to faculty
    const assignedSubjectsMap = new Map();
    mySlots.forEach((slot) => {
      const sub = slot.subject;
      if (!sub) return;
      const subId = sub._id || sub.id || (typeof sub === 'string' ? sub : null);
      if (!subId) return;
      const key = String(subId);
      if (!assignedSubjectsMap.has(key)) {
        const fullSub = typeof sub === 'object' && sub.name
          ? sub
          : subjects.find((s) => String(s._id || s.id) === key) || { _id: subId, name: 'Allocated Subject', code: 'SUB' };
        assignedSubjectsMap.set(key, {
          ...fullSub,
          semester: slot.semester || fullSub.semester,
          course: slot.course || fullSub.course,
          section: slot.section || 'A',
          department: slot.department || fullSub.department,
          roomNumber: slot.roomNumber
        });
      }
    });
    const assignedSubjects = Array.from(assignedSubjectsMap.values());

    // Helper: Enrolled students for a given subject
    const getStudentsForSubject = (subjectId) => {
      const sub = assignedSubjects.find((s) => String(s._id || s.id) === String(subjectId));
      if (!sub) return [];
      const subSem = Number(sub.semester);
      const subDeptId = sub.department?._id || sub.department?.id || (typeof sub.department === 'string' ? sub.department : null);

      return students.filter((st) => {
        const stSem = Number(st.currentSemester);
        if (subSem && stSem !== subSem) return false;
        if (subDeptId) {
          const stDeptId = st.department?._id || st.department?.id || (typeof st.department === 'string' ? st.department : null);
          if (stDeptId && String(stDeptId) !== String(subDeptId)) return false;
        }
        return true;
      });
    };

    // All unique students enrolled across assigned subjects
    const assignedStudentsMap = new Map();
    if (assignedSubjects.length === 0) {
      const myDeptId = facultyUser?.department?._id || facultyUser?.department?.id || facultyUser?.department;
      if (myDeptId) {
        students.forEach((st) => {
          const stDeptId = st.department?._id || st.department?.id || st.department;
          if (stDeptId && (String(stDeptId) === String(myDeptId) || st.department?.name === myDeptName)) {
            assignedStudentsMap.set(String(st._id || st.id), st);
          }
        });
      }
    } else {
      assignedSubjects.forEach((sub) => {
        const list = getStudentsForSubject(sub._id || sub.id);
        list.forEach((st) => {
          assignedStudentsMap.set(String(st._id || st.id), st);
        });
      });
    }
    const assignedStudents = Array.from(assignedStudentsMap.values());

    // Today's schedule slots
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todaySlots = mySlots
      .filter((slot) => slot.dayOfWeek && slot.dayOfWeek.toLowerCase() === todayName.toLowerCase())
      .sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));

    // Attendance stats from real records
    const assignedSubIdSet = new Set(assignedSubjects.map((s) => String(s._id || s.id)));
    const relevantAttendance = assignedSubIdSet.size > 0
      ? attendanceRecords.filter((r) => {
          const sId = r.subject?._id || r.subject?.id || r.subject;
          return assignedSubIdSet.has(String(sId));
        })
      : attendanceRecords;

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    relevantAttendance.forEach((r) => {
      const st = r.status?.toLowerCase();
      if (st === 'present') presentCount++;
      else if (st === 'absent') absentCount++;
      else if (st === 'late') lateCount++;
    });
    const totalAttRecords = presentCount + absentCount + lateCount;
    const attPercentage = totalAttRecords > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalAttRecords) * 100) : 0;
    const attendanceDonutData = totalAttRecords > 0 ? [
      { label: 'Present', value: presentCount, color: '#10b981' },
      { label: 'Absent', value: absentCount, color: '#ef4444' },
      { label: 'Late', value: lateCount, color: '#f59e0b' }
    ] : [];

    // Pending tasks calculation
    let pendingCount = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    todaySlots.forEach((slot) => {
      const subId = slot.subject?._id || slot.subject?.id || slot.subject;
      const isMarked = attendanceRecords.some((r) => {
        const rSubId = r.subject?._id || r.subject?.id || r.subject;
        const rDateStr = r.date ? new Date(r.date).toISOString().split('T')[0] : '';
        return String(rSubId) === String(subId) && rDateStr === todayStr && Number(r.periodNumber) === Number(slot.periodNumber);
      });
      if (!isMarked) pendingCount++;
    });
    exams.forEach((ex) => {
      if (!ex.isPublished) pendingCount++;
    });

    // Attendance Modal helpers
    const handleOpenAttendanceModal = () => {
      const subId = attendanceSubjectId || (assignedSubjects[0] ? (assignedSubjects[0]._id || assignedSubjects[0].id) : '');
      setAttendanceSubjectId(subId);
      const studs = getStudentsForSubject(subId);
      setStudentRoster(studs.map((s) => ({
        studentId: s._id || s.id,
        rollNumber: s.rollNumber,
        name: s.user?.name || 'Student',
        email: s.user?.email || '',
        status: 'present',
        remarks: ''
      })));
      setFormError('');
      setIsMarkAttendanceOpen(true);
    };

    const handleModalSubjectChange = (subId) => {
      setAttendanceSubjectId(subId);
      const studs = getStudentsForSubject(subId);
      setStudentRoster(studs.map((s) => ({
        studentId: s._id || s.id,
        rollNumber: s.rollNumber,
        name: s.user?.name || 'Student',
        email: s.user?.email || '',
        status: 'present',
        remarks: ''
      })));
    };

    const handleMarkAllPresent = () => {
      setStudentRoster((prev) => prev.map((s) => ({ ...s, status: 'present' })));
    };

    const handleStudentStatusToggle = (studentId, status) => {
      setStudentRoster((prev) => prev.map((s) => s.studentId === studentId ? { ...s, status } : s));
    };

    const handleStudentRemarkChange = (studentId, remarks) => {
      setStudentRoster((prev) => prev.map((s) => s.studentId === studentId ? { ...s, remarks } : s));
    };

    const handleFullAttendanceSubmit = async (e) => {
      e.preventDefault();
      setFormError('');
      if (!attendanceSubjectId) {
        setFormError('Please select a curriculum subject.');
        return;
      }
      if (!studentRoster || studentRoster.length === 0) {
        setFormError('No students enrolled in this subject to mark attendance.');
        return;
      }
      setIsSubmitting(true);
      try {
        await api.markAttendanceBatch({
          subject: attendanceSubjectId,
          date: attendanceDate,
          periodNumber: Number(attendancePeriod),
          records: studentRoster.map((s) => ({
            studentId: s.studentId,
            status: s.status,
            remarks: s.remarks || attendanceRemarks || ''
          }))
        });
        addToast({
          type: 'success',
          title: 'Class Attendance Recorded',
          message: `Recorded session attendance for ${studentRoster.length} students.`
        });
        setIsMarkAttendanceOpen(false);
        await loadData();
      } catch (err) {
        setFormError(err.message || 'Failed to submit classroom attendance session.');
      } finally {
        setIsSubmitting(false);
      }
    };

    // Roster Tab Filtering & Pagination
    const filteredRosterStudents = assignedStudents.filter((st) => {
      if (rosterSemesterFilter !== 'all' && Number(st.currentSemester) !== Number(rosterSemesterFilter)) {
        return false;
      }
      if (rosterSubjectFilter !== 'all') {
        const subjectStudents = getStudentsForSubject(rosterSubjectFilter);
        const isEnrolled = subjectStudents.some((s) => (s._id || s.id) === (st._id || st.id));
        if (!isEnrolled) return false;
      }
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const matchRoll = st.rollNumber?.toLowerCase().includes(q);
        const matchName = st.user?.name?.toLowerCase().includes(q);
        const matchEmail = st.user?.email?.toLowerCase().includes(q);
        if (!matchRoll && !matchName && !matchEmail) return false;
      }
      return true;
    });

    const totalRosterPages = Math.max(1, Math.ceil(filteredRosterStudents.length / ROSTER_PAGE_SIZE));
    const paginatedRosterStudents = filteredRosterStudents.slice(
      (rosterPage - 1) * ROSTER_PAGE_SIZE,
      rosterPage * ROSTER_PAGE_SIZE
    );

    const handleExportRosterCSV = () => {
      const exportData = filteredRosterStudents.map((st) => {
        const stRecords = relevantAttendance.filter((r) => {
          const rStId = r.student?._id || r.student?.id || r.student;
          return String(rStId) === String(st._id || st.id);
        });
        const present = stRecords.filter((r) => r.status === 'present').length;
        const attPct = stRecords.length > 0 ? `${Math.round((present / stRecords.length) * 100)}%` : 'No Records';

        return {
          rollNumber: st.rollNumber,
          name: st.user?.name || 'Student',
          email: st.user?.email || '',
          department: st.department?.name || myDeptName,
          semester: `Semester ${st.currentSemester}`,
          batchYear: st.batchYear || '',
          attendanceRate: attPct,
          status: st.admissionStatus || 'Enrolled'
        };
      });

      exportToCsv('classroom_student_roster', exportData, [
        { header: 'Roll Number', key: 'rollNumber' },
        { header: 'Student Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Department', key: 'department' },
        { header: 'Semester', key: 'semester' },
        { header: 'Batch Year', key: 'batchYear' },
        { header: 'Attendance %', key: 'attendanceRate' },
        { header: 'Admission Status', key: 'status' }
      ]);
    };

    // Exams Tab & Marks Entry
    const effectiveExamId = selectedExamId || (exams[0] ? (exams[0]._id || exams[0].id) : '');
    const effectiveExamSubjectId = selectedExamSubjectId || (assignedSubjects[0] ? (assignedSubjects[0]._id || assignedSubjects[0].id) : '');

    const filteredExamResults = results.filter((res) => {
      const resExamId = res.examination?._id || res.examination?.id || res.examination;
      const resSubId = res.subject?._id || res.subject?.id || res.subject;
      if (effectiveExamId && String(resExamId) !== String(effectiveExamId)) return false;
      if (effectiveExamSubjectId && String(resSubId) !== String(effectiveExamSubjectId)) return false;
      return true;
    });

    const handleOpenMarksModal = () => {
      if (!effectiveExamId || !effectiveExamSubjectId) {
        addToast({
          type: 'warning',
          title: 'Select Exam & Subject',
          message: 'Please select both an examination and an assigned subject first.'
        });
        return;
      }
      const studs = getStudentsForSubject(effectiveExamSubjectId);
      const roster = studs.map((st) => {
        const stId = st._id || st.id;
        const existing = results.find((r) => {
          const rStId = r.student?._id || r.student?.id || r.student;
          const rSubId = r.subject?._id || r.subject?.id || r.subject;
          const rExId = r.examination?._id || r.examination?.id || r.examination;
          return String(rStId) === String(stId) && String(rSubId) === String(effectiveExamSubjectId) && String(rExId) === String(effectiveExamId);
        });

        return {
          studentId: stId,
          rollNumber: st.rollNumber,
          name: st.user?.name || 'Student',
          internalMarks: existing?.internalMarks !== undefined ? existing.internalMarks : '',
          externalMarks: existing?.externalMarks !== undefined ? existing.externalMarks : ''
        };
      });
      setMarksRoster(roster);
      setMarksFormError('');
      setIsMarksModalOpen(true);
    };

    const handleMarksChange = (studentId, field, val) => {
      setMarksRoster((prev) => prev.map((s) => s.studentId === studentId ? { ...s, [field]: val } : s));
    };

    const handleBatchMarksSubmit = async (e) => {
      e.preventDefault();
      setMarksFormError('');

      for (const row of marksRoster) {
        const internal = Number(row.internalMarks);
        const external = Number(row.externalMarks);
        if (row.internalMarks === '' || isNaN(internal) || internal < 0 || internal > 40) {
          setMarksFormError(`Internal marks for ${row.rollNumber} must be between 0 and 40.`);
          return;
        }
        if (row.externalMarks === '' || isNaN(external) || external < 0 || external > 60) {
          setMarksFormError(`External marks for ${row.rollNumber} must be between 0 and 60.`);
          return;
        }
      }

      setIsSubmitting(true);
      try {
        await api.batchRecordResults({
          examination: effectiveExamId,
          subject: effectiveExamSubjectId,
          records: marksRoster.map((row) => ({
            studentId: row.studentId,
            internalMarks: Number(row.internalMarks),
            externalMarks: Number(row.externalMarks)
          }))
        });
        addToast({
          type: 'success',
          title: 'Marks Saved Successfully',
          message: `Evaluation marks persisted and server grades computed for ${marksRoster.length} students.`
        });
        setIsMarksModalOpen(false);
        await loadData();
      } catch (err) {
        setMarksFormError(err.message || 'Failed to submit examination marks.');
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleExportMarksCSV = () => {
      const exportData = filteredExamResults.map((r) => ({
        rollNumber: r.student?.rollNumber || '',
        name: r.student?.user?.name || 'Student',
        examination: r.examination?.name || '',
        subject: r.subject?.name || '',
        internalMarks: r.internalMarks ?? 0,
        externalMarks: r.externalMarks ?? 0,
        totalMarks: r.totalMarks ?? 0,
        grade: r.grade || 'F',
        status: r.status || 'Pending'
      }));

      exportToCsv('examination_results_marks', exportData, [
        { header: 'Roll Number', key: 'rollNumber' },
        { header: 'Student Name', key: 'name' },
        { header: 'Examination', key: 'examination' },
        { header: 'Subject', key: 'subject' },
        { header: 'Internal (40)', key: 'internalMarks' },
        { header: 'External (60)', key: 'externalMarks' },
        { header: 'Total (100)', key: 'totalMarks' },
        { header: 'Grade', key: 'grade' },
        { header: 'Status', key: 'status' }
      ]);
    };

    return (
      <div className="space-y-6">
        {/* Modern Purple Hero Banner */}
        <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-6 sm:p-7 text-white shadow-card relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-black/20 text-purple-200 text-xs font-medium mb-3 backdrop-blur-sm border border-white/10">
              <span>{myDeptName}</span>
              <span>&bull;</span>
              <span>{facultyUser?.designation || 'Faculty Member'}</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-purple-100 tracking-wide">
              Welcome back, {user?.name || 'Faculty Member'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              Faculty Dashboard
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-purple-100/90 font-normal">
              Teaching schedule, student management, and academic evaluations
            </p>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsProfileModalOpen(true)}
              icon={User}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              Profile & Workload
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenAttendanceModal}
              icon={CalendarCheck}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              Mark Attendance
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadData}
              icon={RefreshCw}
              isLoading={isLoading}
              title="Refresh Dashboard Data"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            />
            <CampusBuildingGraphic className="w-48 h-24 sm:w-56 sm:h-28 opacity-90 text-white pointer-events-none drop-shadow-md hidden md:block" />
          </div>
        </div>

        {/* Real KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatWidget
            title="Assigned Subjects"
            value={assignedSubjects.length}
            subtitle={`${assignedSubjects.length} Active Allocations`}
            icon={BookOpen}
            color="purple"
          />
          <StatWidget
            title="Classes This Week"
            value={mySlots.length}
            subtitle={`${todaySlots.length} Scheduled Today`}
            icon={Clock}
            color="purple"
          />
          <StatWidget
            title="Total Students"
            value={assignedStudents.length}
            subtitle="Enrolled Across Classes"
            icon={Users}
            color="purple"
          />
          <StatWidget
            title="Pending Tasks"
            value={pendingCount}
            subtitle="Unmarked Sessions & Exams"
            icon={AlertTriangle}
            color="purple"
          />
        </div>

        {/* Row 2: Today's Timetable & Student Attendance (This Month) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Today's Timetable</h2>
                  <Badge variant="purple" size="xs">{todayName}</Badge>
                </div>
                <button
                  onClick={() => handleTabChange('timetable')}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 cursor-pointer"
                >
                  View Full Schedule &rarr;
                </button>
              </div>

              {todaySlots.length === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600">No lecture periods scheduled for {todayName}.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Enjoy your schedule or review weekly slots.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySlots.map((slot) => (
                    <div key={slot._id || slot.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-mono font-bold text-slate-700 w-32">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
                            {slot.subject?.name || slot.subject?.code || 'Lecture Period'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Period {slot.periodNumber} &bull; Semester {slot.semester}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="teal" size="xs">Room {slot.roomNumber || 'LH-101'}</Badge>
                        <span className="text-[10px] text-slate-500 block mt-1">Sec {slot.section || 'A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Student Attendance (This Month)</h2>
                {totalAttRecords > 0 && (
                  <Badge variant="emerald" size="xs">{totalAttRecords} Records</Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-4">Real distribution from verified classroom session records</p>

              {totalAttRecords === 0 ? (
                <div className="py-10 text-center text-slate-500">
                  <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600">No attendance sessions recorded yet this month.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Use the "Mark Attendance" button above to record session rosters.</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                  <SimpleDonutChart
                    data={attendanceDonutData}
                    centerLabel="Compliance"
                    centerValue={`${attPercentage}%`}
                    size={170}
                    thickness={20}
                  />
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                      <span className="font-medium text-slate-700">Present:</span>
                      <span className="font-bold text-slate-900">{presentCount}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                      <span className="font-medium text-slate-700">Absent:</span>
                      <span className="font-bold text-slate-900">{absentCount}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      <span className="font-medium text-slate-700">Late:</span>
                      <span className="font-bold text-slate-900">{lateCount}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: My Subjects & Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">My Subjects</h2>
              <button
                onClick={() => handleTabChange('courses')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 cursor-pointer"
              >
                View All Courses &rarr;
              </button>
            </div>

            {assignedSubjects.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No teaching allocations assigned to your profile.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedSubjects.map((sub) => {
                  const studentCount = getStudentsForSubject(sub._id || sub.id).length;
                  return (
                    <div key={sub._id || sub.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
                            {sub.code} - {sub.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Semester {sub.semester} &bull; {sub.credits} Credits &bull; Room {sub.roomNumber || 'LH-101'}
                          </span>
                        </div>
                      </div>
                      <Badge variant="purple" size="xs">
                        {studentCount} Students
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Activities</h2>
              <button
                onClick={() => handleTabChange('roster')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 cursor-pointer"
              >
                View Rosters &rarr;
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No recorded faculty actions yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Actions like attendance and marks entry will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 4).map((act, i) => {
                  const display = getActivityDisplay(act);
                  const Icon = display.icon;
                  return (
                    <div key={act._id || i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${display.color.split(' ')[1]}`}>
                          <Icon className={`w-4 h-4 ${display.color.split(' ')[0]}`} />
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-slate-800">{display.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{formatRelativeTime(act.createdAt)}</p>
                        </div>
                      </div>
                      <Badge variant="slate" size="xs">Audit Log</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Faculty Notifications & Action Center */}
        <FacultyNotificationsCenter
          assignments={assignments}
          exams={exams}
          timetableSlots={mySlots}
          notices={notices}
          onNavigateTab={handleTabChange}
        />

        {/* Navigation Tabs (URL Synchronized) */}
        <div className="flex border-b border-navy-200 bg-white px-4 rounded-xl shadow-subtle overflow-x-auto">
          <button
            onClick={() => handleTabChange('timetable')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              facultyActiveTab === 'timetable'
                ? 'border-purple-600 text-purple-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Weekly Teaching Timetable ({mySlots.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('courses')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              facultyActiveTab === 'courses'
                ? 'border-purple-600 text-purple-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Assigned Courses & Syllabus ({assignedSubjects.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('assignments')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              facultyActiveTab === 'assignments'
                ? 'border-purple-600 text-purple-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Assignments & Submissions ({assignments.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('roster')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              facultyActiveTab === 'roster'
                ? 'border-purple-600 text-purple-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Classroom Student Rosters ({assignedStudents.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('exams')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              facultyActiveTab === 'exams'
                ? 'border-purple-600 text-purple-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Examinations & Marks ({exams.length})</span>
          </button>

          <button
            onClick={() => handleTabChange('analytics')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
              facultyActiveTab === 'analytics'
                ? 'border-purple-600 text-purple-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Attendance Analytics</span>
          </button>
        </div>

        {/* TAB 1: Weekly Timetable */}
        {facultyActiveTab === 'timetable' && (
          <Card
            title="Weekly Teaching Schedule & Timetable Slots"
            subtitle="Lecture periods and classroom allotments assigned to your faculty profile"
          >
            {mySlots.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No individual timetable sessions scheduled for your profile this week.</p>
            ) : (
              <div className="space-y-2">
                {mySlots.map((slot) => {
                  const isToday = slot.dayOfWeek && slot.dayOfWeek.toLowerCase() === todayName.toLowerCase();
                  return (
                    <div
                      key={slot._id || slot.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                        isToday ? 'bg-purple-50/60 border-purple-200' : 'bg-warm-50 border-navy-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-navy-950 block">{slot.subject?.name || slot.subject?.code || 'Class Lecture'}</span>
                          {isToday && <Badge variant="purple" size="xs">Today</Badge>}
                        </div>
                        <span className="text-[11px] text-navy-500 font-mono">
                          {slot.dayOfWeek?.toUpperCase()} &bull; Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                        </span>
                      </div>
                      <div className="text-right">
                        <Badge variant="teal" size="xs">Room {slot.roomNumber || 'LH-101'}</Badge>
                        <span className="text-[10px] text-navy-500 block mt-1">
                          Section {slot.section || 'A'} &bull; Semester {slot.semester} &bull; {slot.department?.name || myDeptName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* TAB 2: Courses & Syllabus Progress */}
        {facultyActiveTab === 'courses' && (
          <SyllabusMaterialsSection
            assignedSubjects={assignedSubjects}
            materials={materials}
            onRefreshMaterials={handleRefreshMaterials}
            onAddToast={addToast}
          />
        )}

        {/* TAB 3: Student Roster */}
        {facultyActiveTab === 'roster' && (
          <Card
            title="Classroom Student Rosters"
            subtitle={`Enrolled undergraduate students in Department of ${myDeptName}`}
            headerAction={
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="xs" onClick={handleExportRosterCSV} icon={Download}>
                  Export CSV
                </Button>
                <Button variant="teal" size="xs" onClick={handleOpenAttendanceModal} icon={CalendarCheck}>
                  Mark Session
                </Button>
              </div>
            }
          >
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students by name or roll number..."
                  value={rosterSearch}
                  onChange={(e) => {
                    setRosterSearch(e.target.value);
                    setRosterPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <select
                value={rosterSubjectFilter}
                onChange={(e) => {
                  setRosterSubjectFilter(e.target.value);
                  setRosterPage(1);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="all">All Assigned Subjects</option>
                {assignedSubjects.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>

              <select
                value={rosterSemesterFilter}
                onChange={(e) => {
                  setRosterSemesterFilter(e.target.value);
                  setRosterPage(1);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="all">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>

            {filteredRosterStudents.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No student records match the active criteria.</p>
            ) : (
              <div className="space-y-2">
                {paginatedRosterStudents.map((stud) => {
                  const stRecords = relevantAttendance.filter((r) => {
                    const rStId = r.student?._id || r.student?.id || r.student;
                    return String(rStId) === String(stud._id || stud.id);
                  });
                  const present = stRecords.filter((r) => r.status === 'present').length;
                  const attPct = stRecords.length > 0 ? `${Math.round((present / stRecords.length) * 100)}%` : null;

                  return (
                    <div key={stud._id || stud.id} className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-teal-900">{stud.rollNumber}</span>
                          <span className="font-semibold text-navy-950">{stud.user?.name || 'Student'}</span>
                        </div>
                        <span className="text-[11px] text-navy-500 font-mono block mt-0.5">{stud.user?.email}</span>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <span className="text-xs font-bold text-navy-800">Sem {stud.currentSemester}</span>
                          {attPct ? (
                            <Badge variant="emerald" size="xs">{attPct} Attended</Badge>
                          ) : (
                            <Badge variant="slate" size="xs">No Attendance</Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-navy-500 font-mono block mt-1">{stud.batchYear} &bull; {stud.admissionStatus || 'Enrolled'}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination Controls */}
                {totalRosterPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">
                      Showing {(rosterPage - 1) * ROSTER_PAGE_SIZE + 1} to {Math.min(rosterPage * ROSTER_PAGE_SIZE, filteredRosterStudents.length)} of {filteredRosterStudents.length} students
                    </span>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled={rosterPage === 1}
                        onClick={() => setRosterPage((p) => Math.max(1, p - 1))}
                        icon={ChevronLeft}
                      >
                        Previous
                      </Button>
                      <span className="font-semibold text-slate-700 px-1">
                        {rosterPage} / {totalRosterPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled={rosterPage >= totalRosterPages}
                        onClick={() => setRosterPage((p) => Math.min(totalRosterPages, p + 1))}
                        icon={ChevronRight}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* TAB 4: Exams & Marks Entry */}
        {facultyActiveTab === 'exams' && (
          <Card
            title="Institutional Examinations & Marks Entry"
            subtitle="Scheduled mid-term/semester evaluations and student grade entry"
            headerAction={
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="xs" onClick={handleExportMarksCSV} icon={Download}>
                  Export CSV
                </Button>
                <Button variant="teal" size="xs" onClick={handleOpenMarksModal} icon={Award}>
                  Enter / Edit Marks
                </Button>
              </div>
            }
          >
            {/* Exam and Subject Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Examination Cycle</label>
                <select
                  value={effectiveExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {exams.map((ex) => (
                    <option key={ex._id || ex.id} value={ex._id || ex.id}>
                      {ex.name} ({ex.examType} - Sem {ex.semester})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Assigned Subject</label>
                <select
                  value={effectiveExamSubjectId}
                  onChange={(e) => setSelectedExamSubjectId(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {assignedSubjects.map((s) => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.code} - {s.name} (Sem {s.semester})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredExamResults.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No marks recorded yet for this examination and subject.</p>
                <p className="text-[11px] text-slate-400 mt-1">Click "Enter / Edit Marks" above to evaluate student performance.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Roll Number</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Internal (40)</th>
                      <th className="py-2.5 px-3">External (60)</th>
                      <th className="py-2.5 px-3">Total (100)</th>
                      <th className="py-2.5 px-3">Grade</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExamResults.map((r) => (
                      <tr key={r._id || r.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.student?.rollNumber}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{r.student?.user?.name || 'Student'}</td>
                        <td className="py-2.5 px-3 font-mono">{r.internalMarks}</td>
                        <td className="py-2.5 px-3 font-mono">{r.externalMarks}</td>
                        <td className="py-2.5 px-3 font-mono font-bold">{r.totalMarks}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant={r.grade === 'F' ? 'danger' : 'emerald'} size="xs">{r.grade}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[11px] font-semibold capitalize ${r.status === 'passed' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* TAB 5: Assignments & Submissions */}
        {facultyActiveTab === 'assignments' && (
          <AssignmentsSection
            assignments={assignments}
            assignedSubjects={assignedSubjects}
            enrolledStudents={assignedStudents}
            onCreateAssignment={handleCreateAssignment}
            onUpdateAssignment={handleUpdateAssignment}
            onDeleteAssignment={handleDeleteAssignment}
            onPublishAssignment={handlePublishAssignment}
            onEvaluateSubmission={handleEvaluateSubmission}
            isLoading={isLoading}
          />
        )}

        {/* TAB 6: Advanced Attendance Analytics */}
        {facultyActiveTab === 'analytics' && (
          <AttendanceAnalyticsSection
            attendanceRecords={attendanceRecords}
            assignedSubjects={assignedSubjects}
            assignedStudents={assignedStudents}
          />
        )}

        {/* Full-Class Classroom Attendance Modal */}
        <Modal
          isOpen={isMarkAttendanceOpen}
          onClose={() => setIsMarkAttendanceOpen(false)}
          title="Classroom Attendance Capture"
          subtitle="Record period session attendance for enrolled students"
          maxWidth="max-w-2xl"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsMarkAttendanceOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="teal" size="sm" onClick={handleFullAttendanceSubmit} isLoading={isSubmitting}>
                Submit Class Attendance ({studentRoster.length} Students)
              </Button>
            </>
          }
        >
          <form onSubmit={handleFullAttendanceSubmit} className="space-y-4">
            {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Subject</label>
                <select
                  value={attendanceSubjectId}
                  onChange={(e) => handleModalSubjectChange(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {assignedSubjects.map((s) => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Date</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Period</label>
                <select
                  value={attendancePeriod}
                  onChange={(e) => setAttendancePeriod(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="1">Period 1 (09:00 - 09:50)</option>
                  <option value="2">Period 2 (10:00 - 10:50)</option>
                  <option value="3">Period 3 (11:00 - 11:50)</option>
                  <option value="4">Period 4 (12:00 - 12:50)</option>
                  <option value="5">Period 5 (01:45 - 02:35)</option>
                  <option value="6">Period 6 (02:45 - 03:35)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-800">
                Enrolled Roster ({studentRoster.length} students)
              </span>
              <Button type="button" variant="secondary" size="xs" onClick={handleMarkAllPresent}>
                Mark All Present
              </Button>
            </div>

            {studentRoster.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No enrolled students found for the selected subject.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                {studentRoster.map((stud) => (
                  <div key={stud.studentId} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/80 text-xs gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-teal-900 block">{stud.rollNumber}</span>
                      <span className="font-medium text-slate-900 truncate block">{stud.name}</span>
                    </div>

                    {/* Status Pill Buttons */}
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleStudentStatusToggle(stud.studentId, 'present')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                          stud.status === 'present'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStudentStatusToggle(stud.studentId, 'late')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                          stud.status === 'late'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Late
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStudentStatusToggle(stud.studentId, 'absent')}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                          stud.status === 'absent'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Absent
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Remarks (opt)"
                      value={stud.remarks}
                      onChange={(e) => handleStudentRemarkChange(stud.studentId, e.target.value)}
                      className="w-24 text-[11px] px-2 py-1 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 hidden sm:block"
                    />
                  </div>
                ))}
              </div>
            )}

            <Input
              label="Session Summary / Remarks (Optional)"
              id="full-att-remarks"
              value={attendanceRemarks}
              onChange={(e) => setAttendanceRemarks(e.target.value)}
              placeholder="e.g. Unit 3 Trees & Graphs covered"
            />
          </form>
        </Modal>

        {/* Examination Marks Entry Modal */}
        <Modal
          isOpen={isMarksModalOpen}
          onClose={() => setIsMarksModalOpen(false)}
          title="Enter Examination Marks"
          subtitle="Record internal and external evaluation marks for enrolled students"
          maxWidth="max-w-2xl"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsMarksModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="teal" size="sm" onClick={handleBatchMarksSubmit} isLoading={isSubmitting}>
                Save & Compute Grades
              </Button>
            </>
          }
        >
          <form onSubmit={handleBatchMarksSubmit} className="space-y-4">
            {marksFormError && <Notification type="error" message={marksFormError} onClose={() => setMarksFormError('')} />}

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-900">
              <span className="font-semibold block mb-0.5">Evaluation Guidelines:</span>
              <span>Internal marks range from <strong>0 to 40</strong>. External marks range from <strong>0 to 60</strong>. Total marks and final letter grades (O, A+, A, B+, B, C, F) are computed dynamically by the institutional grading engine.</span>
            </div>

            {marksRoster.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No enrolled students found to grade.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                {marksRoster.map((stud) => {
                  const intVal = stud.internalMarks !== '' ? Number(stud.internalMarks) : null;
                  const extVal = stud.externalMarks !== '' ? Number(stud.externalMarks) : null;
                  const total = intVal !== null && extVal !== null ? intVal + extVal : '—';

                  return (
                    <div key={stud.studentId} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200/80 text-xs gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-bold text-teal-900 block">{stud.rollNumber}</span>
                        <span className="font-medium text-slate-900 truncate block">{stud.name}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div>
                          <label className="text-[10px] text-slate-500 block font-semibold">Int (0-40)</label>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            value={stud.internalMarks}
                            onChange={(e) => handleMarksChange(stud.studentId, 'internalMarks', e.target.value)}
                            className="w-16 text-xs px-2 py-1 rounded border border-slate-200 font-mono text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder="0-40"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 block font-semibold">Ext (0-60)</label>
                          <input
                            type="number"
                            min="0"
                            max="60"
                            step="0.5"
                            value={stud.externalMarks}
                            onChange={(e) => handleMarksChange(stud.studentId, 'externalMarks', e.target.value)}
                            className="w-16 text-xs px-2 py-1 rounded border border-slate-200 font-mono text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder="0-60"
                          />
                        </div>

                        <div className="text-center w-14">
                          <span className="text-[10px] text-slate-500 block font-semibold">Total</span>
                          <span className="text-xs font-mono font-bold text-purple-700 block mt-1">{total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        </Modal>

        {/* Faculty Profile & Workload Modal */}
        <FacultyProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          profile={myProfile}
          user={user}
          assignedSubjects={assignedSubjects}
          timetableSlots={mySlots}
        />
      </div>
    );
  }

  // ==========================================
  // VIEW 2: SUPER ADMIN / MANAGEMENT FACULTY ROSTER
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-navy-900 rounded-2xl p-6 text-white shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-teal-500/30">
            <CalendarCheck className="w-3.5 h-3.5 mr-1" />
            <span>Faculty Workplace & Academic Staff Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Teaching Faculty Administration</h1>
          <p className="mt-1 text-xs sm:text-sm text-navy-200 font-light">
            Authorized oversight of academic staff profiles, department designations, timetable slots, and credentials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="teal"
            size="md"
            onClick={handleOpenCreate}
            icon={UserPlus}
            className="shadow-elevation"
          >
            Provision Faculty Profile
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatWidget
          title="Total Faculty Staff"
          value={`${facultyList.length} Members`}
          subtitle="Registered in College"
          icon={Users}
          color="teal"
        />
        <StatWidget
          title="Departments Staffed"
          value={`${departments.length} Units`}
          subtitle="Engineering Faculties"
          icon={Building2}
          color="navy"
        />
        <StatWidget
          title="Teaching Subjects"
          value={`${subjects.length} Courses`}
          subtitle="Curriculum Progression"
          icon={BookOpen}
          color="emerald"
        />
        <StatWidget
          title="Scheduled Lecture Slots"
          value={`${timetableSlots.length} Slots`}
          subtitle="Weekly Master Timetable"
          icon={Clock}
          color="amber"
        />
      </div>

      {/* 1. Faculty Directory Table */}
      <Card
        title="Institutional Faculty Directory"
        subtitle="Manage designations, specializations, qualifications, and account access"
        headerAction={
          <Button
            variant="teal"
            size="xs"
            onClick={handleOpenCreate}
            icon={UserPlus}
          >
            New Faculty
          </Button>
        }
      >
        {/* Filters */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="search-faculty"
            placeholder="Search by ID, name, email or field..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />

          <Select
            id="filter-dept"
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            options={[
              { value: '', label: 'All Academic Departments' },
              ...departments.map((d) => ({ value: d._id, label: d.name }))
            ]}
          />

          <Select
            id="filter-desig"
            value={selectedDesigFilter}
            onChange={(e) => setSelectedDesigFilter(e.target.value)}
            options={[
              { value: '', label: 'All Designations' },
              { value: 'Professor', label: 'Professor' },
              { value: 'Associate Professor', label: 'Associate Professor' },
              { value: 'Assistant Professor', label: 'Assistant Professor' },
              { value: 'Lecturer', label: 'Lecturer' },
              { value: 'Lab Assistant', label: 'Lab Assistant' }
            ]}
          />
        </div>

        <Table
          columns={facultyColumns}
          data={filteredFaculty}
          keyField="_id"
          isLoading={isLoading}
          emptyMessage="No faculty profiles match the search parameters."
        />
      </Card>

      {/* 2. Course & Timetable Schedules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Curriculum Subjects Allocated to Faculty"
          subtitle="Department lecture courses & lab credits"
        >
          {subjects.length === 0 ? (
            <p className="text-xs text-navy-400 py-6 text-center">No subjects recorded.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {subjects.map((sub) => (
                <div key={sub._id} className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-navy-900 block">{sub.name}</span>
                    <span className="text-[11px] text-navy-500 font-mono">
                      {sub.code} &bull; Semester {sub.semester}
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
          title="Class Timetable & Scheduled Sessions"
          subtitle="Allocated lecture periods across departments"
        >
          {timetableSlots.length === 0 ? (
            <p className="text-xs text-navy-400 py-6 text-center">No timetable slots scheduled.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {timetableSlots.map((slot) => (
                <div key={slot._id} className="p-3 rounded-xl bg-white border border-navy-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-navy-900 block">
                      {slot.subject?.name || 'Class Period'}
                    </span>
                    <span className="text-[11px] text-navy-500 font-mono">
                      {slot.dayOfWeek} &bull; Period {slot.periodNumber} &bull; Venue: {slot.roomNumber || 'Room 302'}
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

      {/* Modal 1: Edit Faculty Profile */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Faculty Profile: ${selectedFaculty?.employeeId || ''}`}
        subtitle={`Update academic designation and department for ${selectedFaculty?.user?.name || 'Staff'}`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditSubmit} isLoading={isSubmitting}>
              Save Profile
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <Select
            label="Academic Designation"
            id="edit-desig"
            value={editForm.designation}
            onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
            options={[
              { value: 'Professor', label: 'Professor' },
              { value: 'Associate Professor', label: 'Associate Professor' },
              { value: 'Assistant Professor', label: 'Assistant Professor' },
              { value: 'Lecturer', label: 'Lecturer' },
              { value: 'Lab Assistant', label: 'Lab Assistant' }
            ]}
          />

          <Select
            label="Department"
            id="edit-dept"
            value={editForm.department}
            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            options={departments.map((d) => ({ value: d._id, label: d.name }))}
          />

          <Input
            label="Qualification / Degrees"
            id="edit-qual"
            value={editForm.qualification}
            onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })}
            placeholder="e.g. Ph.D. in Computer Science"
          />

          <Input
            label="Specialization / Area of Research"
            id="edit-spec"
            value={editForm.specialization}
            onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
            placeholder="e.g. Distributed Systems & Algorithms"
          />
        </form>
      </Modal>

      {/* Modal 2: Provision Faculty Profile */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Provision Faculty Member"
        subtitle="Creates an institutional account and linked faculty profile record"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="teal" size="sm" onClick={handleCreateSubmit} isLoading={isSubmitting}>
              Create Faculty Member
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              id="fac-name"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g. Dr. Alan Turing"
            />

            <Input
              label="Employee ID"
              id="fac-empid"
              required
              value={createForm.employeeId}
              onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
              placeholder="e.g. FAC-CSE-009"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Institutional Email"
              id="fac-email"
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="e.g. faculty02@college.edu"
            />

            <Input
              label="Initial Password"
              id="fac-pass"
              type="password"
              required
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="At least 6 characters"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department"
              id="fac-dept"
              value={createForm.departmentId}
              onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
              options={departments.map((d) => ({ value: d._id, label: d.name }))}
            />

            <Select
              label="Designation"
              id="fac-desig"
              value={createForm.designation}
              onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
              options={[
                { value: 'Professor', label: 'Professor' },
                { value: 'Associate Professor', label: 'Associate Professor' },
                { value: 'Assistant Professor', label: 'Assistant Professor' },
                { value: 'Lecturer', label: 'Lecturer' }
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Qualification"
              id="fac-qual"
              value={createForm.qualification}
              onChange={(e) => setCreateForm({ ...createForm, qualification: e.target.value })}
              placeholder="e.g. Ph.D. in Computer Science"
            />

            <Input
              label="Specialization"
              id="fac-spec"
              value={createForm.specialization}
              onChange={(e) => setCreateForm({ ...createForm, specialization: e.target.value })}
              placeholder="e.g. Artificial Intelligence"
            />
          </div>
        </form>
      </Modal>

      {/* Modal 3: Reset Password */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title={`Reset Password for ${selectedFaculty?.user?.name || 'Faculty'}`}
        subtitle={`Set temporary password for ${selectedFaculty?.user?.email || ''}`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsResetOpen(false)} disabled={isSubmitting}>
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
            id="reset-fac-pass"
            type="password"
            required
            value={newPasswordVal}
            onChange={(e) => setNewPasswordVal(e.target.value)}
            placeholder="At least 6 characters"
          />
        </form>
      </Modal>

      {/* Confirm Dialog: Disable / Activate */}
      <ConfirmDialog
        isOpen={!!confirmToggleUser}
        onClose={() => setConfirmToggleUser(null)}
        onConfirm={handleConfirmToggle}
        title={confirmToggleUser?.user?.status === USER_STATUS.ACTIVE ? 'Disable Faculty Account?' : 'Activate Faculty Account?'}
        message={
          confirmToggleUser?.user?.status === USER_STATUS.ACTIVE
            ? `Disabling account '${confirmToggleUser?.user?.email}' will prevent them from logging attendance or marks.`
            : `Activating account '${confirmToggleUser?.user?.email}' will restore access.`
        }
        confirmText={confirmToggleUser?.user?.status === USER_STATUS.ACTIVE ? 'Disable Account' : 'Activate Account'}
        isDanger={confirmToggleUser?.user?.status === USER_STATUS.ACTIVE}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default FacultyDashboard;
