import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  Calendar,
  ShieldCheck,
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
  Plus,
  Filter
} from 'lucide-react';
import Card from '../../components/common/Card';
import CampusBuildingGraphic from '../../components/common/CampusBuildingGraphic';
import DashboardHeaderBanner from '../../components/dashboard/DashboardHeaderBanner';
import DashboardKPICard from '../../components/dashboard/DashboardKPICard';
import DashboardAnalyticsRow from '../../components/dashboard/DashboardAnalyticsRow';
import DashboardWidgetsRow from '../../components/dashboard/DashboardWidgetsRow';
import DashboardModulesNav from '../../components/dashboard/DashboardModulesNav';
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
import RoleLeaveManagement from '../../components/leave/RoleLeaveManagement';
import api from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLES, USER_STATUS, DEPARTMENTS } from '@college-erp/shared';

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
  const [myLeaves, setMyLeaves] = useState([]);
  const [institutionalEvents, setInstitutionalEvents] = useState([]);
  const [noticesList, setNoticesList] = useState([]);
  const [marksList, setMarksList] = useState([]);
  const [kpiStats, setKpiStats] = useState(null);
  const [isKpiLoading, setIsKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState(null);
  // Detail Modals for 3 KPI Cards
  const [isStudentsModalOpen, setIsStudentsModalOpen] = useState(false);
  const [isSubjectsModalOpen, setIsSubjectsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [studentsModalSearch, setStudentsModalSearch] = useState('');

  // Leave Form & Modal
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [leaveSubTab, setLeaveSubTab] = useState('my-leaves');
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'casual',
    startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    reason: ''
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [facultyActiveTab, setFacultyActiveTab] = useState(queryTab || 'timetable');

  useEffect(() => {
    if (queryTab) {
      setFacultyActiveTab(queryTab);
    }
  }, [queryTab]);

  // Attendance Form & Modal
  const [isMarkAttendanceOpen, setIsMarkAttendanceOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    subject: '',
    date: new Date().toISOString().split('T')[0],
    periodNumber: 1,
    status: 'present',
    studentId: '',
    remarks: 'Regular period lecture'
  });

  // Marks Entry Form & Modal
  const [isMarksModalOpen, setIsMarksModalOpen] = useState(false);
  const [marksFilterExam, setMarksFilterExam] = useState('');
  const [marksFilterSubject, setMarksFilterSubject] = useState('');
  const [marksSearchQuery, setMarksSearchQuery] = useState('');
  const [marksFormData, setMarksFormData] = useState({
    examination: '',
    subject: '',
    student: '',
    internalMarks: 25,
    externalMarks: 45,
    status: 'passed'
  });
  const [marksFormError, setMarksFormError] = useState('');
  const [isMarksSubmitting, setIsMarksSubmitting] = useState(false);

  // Attendance Trend Filter
  const [attendanceRange, setAttendanceRange] = useState('This Week');

  const [isLoading, setIsLoading] = useState(true);

  // Management View Filters
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedDesigFilter, setSelectedDesigFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state for admin view
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);

  // Forms for admin view
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

  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFacultyRole = user?.role === ROLES.FACULTY;

  // Unified Data Loading
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isFacultyRole) {
        setIsKpiLoading(true);
        const [
          kpiStatsRes,
          myProfRes,
          subjRes,
          timeRes,
          studRes,
          examRes,
          attRes,
          leavesRes,
          eventsRes,
          noticesRes,
          resultsRes
        ] = await Promise.all([
          api.getFacultyDashboardStats().catch((err) => {
            console.warn('KPI Stats fetch error:', err.message);
            return { data: null, error: err.message };
          }),
          api.getMyFacultyProfile().catch(() => ({ data: null })),
          api.getSubjects().catch(() => ({ data: [] })),
          api.getTimetable().catch(() => ({ data: [] })),
          api.getStudents({ limit: 200 }).catch(() => ({ data: [] })),
          api.getExams().catch(() => ({ data: [] })),
          api.getAttendance().catch(() => ({ data: [] })),
          api.getLeaves().catch(() => ({ data: [] })),
          api.getInstitutionalEvents({ limit: 10 }).catch(() => ({ data: [] })),
          api.getNotices({ limit: 10 }).catch(() => ({ data: [] })),
          api.getResults().catch(() => ({ data: [] }))
        ]);

        if (kpiStatsRes?.data) {
          setKpiStats(kpiStatsRes.data);
          setKpiError(null);
        } else if (kpiStatsRes?.error) {
          setKpiError(kpiStatsRes.error);
        }
        setIsKpiLoading(false);

        if (myProfRes?.data) setMyProfile(myProfRes.data);
        if (subjRes?.data) setSubjects(Array.isArray(subjRes.data) ? subjRes.data : []);
        if (timeRes?.data) setTimetableSlots(Array.isArray(timeRes.data) ? timeRes.data : []);
        
        if (leavesRes?.data?.leaves) setMyLeaves(leavesRes.data.leaves);
        else if (Array.isArray(leavesRes?.data)) setMyLeaves(leavesRes.data);

        const loadedStudents = studRes?.data?.students || (Array.isArray(studRes?.data) ? studRes.data : []);
        setStudents(loadedStudents);

        const loadedExams = Array.isArray(examRes?.data) ? examRes.data : (examRes?.data?.exams || []);
        setExams(loadedExams);

        const loadedAttendance = Array.isArray(attRes?.data) ? attRes.data : [];
        setAttendanceRecords(loadedAttendance);

        const loadedEvents = Array.isArray(eventsRes?.data) ? eventsRes.data : (eventsRes?.data?.events || []);
        setInstitutionalEvents(loadedEvents);

        const loadedNotices = Array.isArray(noticesRes?.data) ? noticesRes.data : (noticesRes?.data?.notices || []);
        setNoticesList(loadedNotices);

        const loadedMarks = Array.isArray(resultsRes?.data) ? resultsRes.data : [];
        setMarksList(loadedMarks);

        // Pre-select defaults for attendance and marks forms
        if (loadedStudents.length > 0) {
          setAttendanceForm((prev) => ({
            ...prev,
            studentId: prev.studentId || loadedStudents[0]._id || loadedStudents[0].id
          }));
          setMarksFormData((prev) => ({
            ...prev,
            student: prev.student || loadedStudents[0]._id || loadedStudents[0].id
          }));
        }

        const loadedSubjects = Array.isArray(subjRes?.data) ? subjRes.data : [];
        if (loadedSubjects.length > 0) {
          setAttendanceForm((prev) => ({
            ...prev,
            subject: prev.subject || loadedSubjects[0]._id || loadedSubjects[0].id
          }));
          setMarksFormData((prev) => ({
            ...prev,
            subject: prev.subject || loadedSubjects[0]._id || loadedSubjects[0].id
          }));
        }

        if (loadedExams.length > 0) {
          setMarksFormData((prev) => ({
            ...prev,
            examination: prev.examination || loadedExams[0]._id || loadedExams[0].id
          }));
        }
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

  // Handle Mark Attendance
  const handleMarkAttendanceSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!attendanceForm.subject) {
      setFormError('Please select a curriculum subject.');
      return;
    }
    if (!attendanceForm.studentId && attendanceForm.studentId !== '__ALL__') {
      setFormError('Please select a student or choose all students.');
      return;
    }

    setIsSubmitting(true);
    try {
      const recordsToSubmit = attendanceForm.studentId === '__ALL__'
        ? myStudents.map((st) => ({
            studentId: st._id || st.id,
            status: attendanceForm.status,
            remarks: attendanceForm.remarks
          }))
        : [
            {
              studentId: attendanceForm.studentId,
              status: attendanceForm.status,
              remarks: attendanceForm.remarks
            }
          ];

      await api.markAttendanceBatch({
        subject: attendanceForm.subject,
        date: attendanceForm.date,
        periodNumber: Number(attendanceForm.periodNumber),
        records: recordsToSubmit
      });

      addToast({
        type: 'success',
        title: 'Attendance Recorded',
        message: `Recorded attendance for ${recordsToSubmit.length} student(s) successfully.`
      });
      setIsMarkAttendanceOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to submit attendance session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Apply Leave
  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!leaveForm.reason.trim()) {
      setFormError('Please enter a reason for leave.');
      return;
    }
    if (new Date(leaveForm.startDate) > new Date(leaveForm.endDate)) {
      setFormError('Leave start date cannot be after end date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.applyLeave(leaveForm);
      addToast({
        type: 'success',
        title: 'Leave Application Submitted',
        message: 'Your leave application has been submitted for review.'
      });
      setIsApplyLeaveOpen(false);
      setLeaveForm({
        leaveType: 'casual',
        startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        reason: ''
      });
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Record / Edit Marks
  const handleMarksSubmit = async (e) => {
    e.preventDefault();
    const internal = Number(marksFormData.internalMarks);
    const external = Number(marksFormData.externalMarks);

    if (internal < 0 || internal > 40) {
      setMarksFormError('Internal Marks must be between 0 and 40.');
      return;
    }
    if (external < 0 || external > 60) {
      setMarksFormError('External Marks must be between 0 and 60.');
      return;
    }

    setIsMarksSubmitting(true);
    setMarksFormError('');
    try {
      await api.recordResult(marksFormData);
      addToast({
        type: 'success',
        title: 'Marks Saved',
        message: 'Student evaluation marks and grade saved to database.'
      });
      setIsMarksModalOpen(false);
      loadData();
    } catch (err) {
      setMarksFormError(err.message || 'Failed to save student marks.');
    } finally {
      setIsMarksSubmitting(false);
    }
  };

  // Open Edit Marks modal with prefilled data
  const handleOpenEditMarks = (markRecord) => {
    setMarksFormData({
      examination: markRecord.examination?._id || markRecord.examination?.id || markRecord.examination || '',
      subject: markRecord.subject?._id || markRecord.subject?.id || markRecord.subject || '',
      student: markRecord.student?._id || markRecord.student?.id || markRecord.student || '',
      internalMarks: markRecord.internalMarks ?? 0,
      externalMarks: markRecord.externalMarks ?? 0,
      status: markRecord.status || 'passed'
    });
    setMarksFormError('');
    setIsMarksModalOpen(true);
  };

  // Open Edit Profile (Admin view)
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

  // Open Create Faculty (Admin view)
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
      const userRes = await api.createUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: ROLES.FACULTY,
        department: departments.find((d) => d._id === createForm.departmentId)?.name || 'Engineering',
        status: USER_STATUS.ACTIVE
      });

      const newUserId = userRes.data?.id || userRes.data?._id;

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

  // Reset Password (Admin view)
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

  // Toggle Status (Admin view)
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

  // Compute Scoped Data for Authenticated Faculty User
  const facultyUser = myProfile || facultyList.find((f) => f.user?._id === user?._id || f.user?.id === user?._id);
  const myDeptName = facultyUser?.department?.name || user?.department || 'Engineering';
  const myDeptId = facultyUser?.department?._id || facultyUser?.department?.id || (typeof facultyUser?.department === 'string' ? facultyUser.department : null);

  // Timetable Slot Matching
  const mySlots = useMemo(() => {
    return timetableSlots.filter((t) => {
      const facId = t.faculty?._id || t.faculty?.id || t.faculty;
      const facUserId = t.faculty?.user?._id || t.faculty?.user?.id || t.faculty?.user;
      const facEmail = t.faculty?.user?.email || t.faculty?.email;
      return (
        facId === facultyUser?._id ||
        facId === user?._id ||
        facUserId === user?._id ||
        facEmail === user?.email
      );
    });
  }, [timetableSlots, facultyUser, user]);

  // Assigned Subjects: Subjects assigned via timetable or department curriculum
  const assignedSubjectIds = useMemo(() => {
    return new Set(
      mySlots
        .map((s) => (s.subject?._id || s.subject?.id || s.subject)?.toString())
        .filter(Boolean)
    );
  }, [mySlots]);

  const mySubjects = useMemo(() => {
    const timetableMatched = subjects.filter((s) =>
      assignedSubjectIds.has((s._id || s.id)?.toString())
    );
    if (timetableMatched.length > 0) return timetableMatched;
    return subjects.filter(
      (s) =>
        s.department?.name === myDeptName ||
        (myDeptId && (s.department?._id === myDeptId || s.department === myDeptId)) ||
        !s.department
    );
  }, [subjects, assignedSubjectIds, myDeptName, myDeptId]);

  // Students in Department / Eligible for this faculty
  const myStudents = useMemo(() => {
    return students.filter((s) => {
      const sDeptId = s.department?._id || s.department?.id || (typeof s.department === 'string' ? s.department : null);
      const sDeptName = s.department?.name;
      return (
        sDeptName === myDeptName ||
        (myDeptId && sDeptId === myDeptId) ||
        !s.department
      );
    });
  }, [students, myDeptName, myDeptId]);

  // Filter students eligible for selected subject in Mark Attendance modal
  const eligibleSubjectStudents = useMemo(() => {
    if (!attendanceForm.subject) return myStudents;
    const subObj = subjects.find(
      (s) => (s._id || s.id) === attendanceForm.subject
    );
    if (!subObj) return myStudents;
    const filtered = myStudents.filter((st) => {
      const semMatch = !subObj.semester || Number(st.currentSemester) === Number(subObj.semester);
      return semMatch;
    });
    return filtered.length > 0 ? filtered : myStudents;
  }, [attendanceForm.subject, subjects, myStudents]);

  // Total Students Taught: distinct students enrolled in semesters & departments of assigned subjects
  const totalStudentsCount = useMemo(() => {
    if (mySubjects.length === 0) return myStudents.length;
    const taughtSet = new Set();
    myStudents.forEach((st) => {
      const match = mySubjects.some((sub) => {
        return !sub.semester || Number(st.currentSemester) === Number(sub.semester);
      });
      if (match) taughtSet.add(st._id || st.id);
    });
    return taughtSet.size > 0 ? taughtSet.size : myStudents.length;
  }, [mySubjects, myStudents]);

  // Class Attendance Percentage Calculation
  const attendanceStats = useMemo(() => {
    const facultyAtt = attendanceRecords.filter((r) => {
      const facId = r.faculty?._id || r.faculty?.id || r.faculty;
      return facId === user?._id || facId === facultyUser?._id;
    });
    const relevant = facultyAtt.length > 0 ? facultyAtt : attendanceRecords;
    const total = relevant.length;
    const present = relevant.filter((r) => r.status === 'present').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : null;
    return { total, present, percentage, records: relevant };
  }, [attendanceRecords, user, facultyUser]);

  // Leave Balance Calculation: 12 days entitlement minus approved leave days
  const leaveBalance = useMemo(() => {
    const approvedDays = myLeaves
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + (l.durationDays || l.numberOfDays || 1), 0);
    return Math.max(0, (user?.leaveBalance ?? 12) - approvedDays);
  }, [myLeaves, user]);

  // Weekly Attendance Average Trend Chart Data
  const weeklyAttendanceTrend = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((day) => {
      const matched = attendanceStats.records.filter((r) => {
        const d = new Date(r.date);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        return dayStr === day;
      });
      const t = matched.length;
      const p = matched.filter((r) => r.status === 'present').length;
      const val = t > 0 ? Math.round((p / t) * 100) : 0;
      return { label: day, val };
    });
  }, [attendanceStats]);

  // Subject Teaching Load Donut Distribution
  const subjectDistribution = useMemo(() => {
    const palette = ['#16a34a', '#8b5cf6', '#06b6d4', '#f59e0b', '#f97316', '#3b82f6'];
    if (mySubjects.length === 0) {
      return [{ name: 'No Subjects', pct: '0%', color: '#94a3b8' }];
    }

    let totalLoad = 0;
    const counts = mySubjects.map((sub, idx) => {
      const enrolled = myStudents.filter((st) => {
        return !sub.semester || Number(st.currentSemester) === Number(sub.semester);
      });
      const count = enrolled.length || 1;
      totalLoad += count;
      return {
        name: sub.code || sub.name,
        count,
        color: palette[idx % palette.length]
      };
    });

    return counts.map((c) => ({
      name: c.name,
      pct: totalLoad > 0 ? `${Math.round((c.count / totalLoad) * 100)}%` : '0%',
      color: c.color
    }));
  }, [mySubjects, myStudents]);

  // Formatted Upcoming Events
  const formattedUpcomingEvents = useMemo(() => {
    return institutionalEvents.slice(0, 4).map((evt) => {
      const d = new Date(evt.startDate);
      const dateMonth = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const dateDay = String(d.getDate()).padStart(2, '0');
      const time = evt.startTime && evt.endTime
        ? `${evt.startTime} – ${evt.endTime}`
        : 'All Day Event';
      const color = evt.priority === 'urgent'
        ? 'bg-rose-50 text-rose-800 border-rose-200'
        : evt.priority === 'high'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-emerald-50 text-emerald-800 border-emerald-200';

      return {
        dateMonth,
        dateDay,
        title: evt.title,
        time,
        color,
        rawDate: evt.startDate
      };
    });
  }, [institutionalEvents]);

  // Formatted Recent Activities (Real DB records)
  const facultyRecentActivities = useMemo(() => {
    const list = [];

    // Recent Attendance Activities
    attendanceStats.records.slice(0, 3).forEach((att) => {
      const d = new Date(att.date || att.createdAt);
      const subCode = att.subject?.code || att.subject?.name || 'Class';
      list.push({
        title: `Attendance session marked - ${subCode} (Period ${att.periodNumber || 1})`,
        time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp: d.getTime(),
        icon: CalendarCheck,
        bg: 'bg-purple-100 text-purple-700'
      });
    });

    // Recent Marks Activities
    marksList.slice(0, 3).forEach((mk) => {
      const d = new Date(mk.updatedAt || mk.createdAt);
      const subCode = mk.subject?.code || mk.subject?.name || 'Subject';
      const roll = mk.student?.rollNumber || 'Student';
      list.push({
        title: `Internal marks evaluated - ${subCode} (${roll}: Grade ${mk.grade})`,
        time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp: d.getTime(),
        icon: Award,
        bg: 'bg-emerald-100 text-emerald-700'
      });
    });

    // Recent Leave Activities
    myLeaves.slice(0, 2).forEach((lv) => {
      const d = new Date(lv.createdAt);
      list.push({
        title: `Leave request (${lv.leaveType}) - ${lv.status.toUpperCase()}`,
        time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp: d.getTime(),
        icon: Clock,
        bg: 'bg-sky-100 text-sky-700'
      });
    });

    // Sort by latest timestamp
    list.sort((a, b) => b.timestamp - a.timestamp);

    if (list.length > 0) return list.slice(0, 4);

    return [
      {
        title: 'Teaching faculty session active',
        time: 'Just now',
        icon: CalendarCheck,
        bg: 'bg-emerald-100 text-emerald-700'
      }
    ];
  }, [attendanceStats, marksList, myLeaves]);

  // Formatted Notices
  const formattedNotices = useMemo(() => {
    const now = Date.now();
    return noticesList.slice(0, 5).map((n) => {
      const isNew = n.publicationDate
        ? now - new Date(n.publicationDate).getTime() < 7 * 86400000
        : true;
      return {
        title: n.title,
        isNew
      };
    });
  }, [noticesList]);

  // Filtered Marks List
  const filteredMarks = useMemo(() => {
    return marksList.filter((m) => {
      if (marksFilterExam && (m.examination?._id || m.examination?.id || m.examination) !== marksFilterExam) {
        return false;
      }
      if (marksFilterSubject && (m.subject?._id || m.subject?.id || m.subject) !== marksFilterSubject) {
        return false;
      }
      if (marksSearchQuery.trim()) {
        const q = marksSearchQuery.toLowerCase();
        const roll = m.student?.rollNumber?.toLowerCase() || '';
        const name = m.student?.user?.name?.toLowerCase() || '';
        const sub = m.subject?.code?.toLowerCase() || '';
        return roll.includes(q) || name.includes(q) || sub.includes(q);
      }
      return true;
    });
  }, [marksList, marksFilterExam, marksFilterSubject, marksSearchQuery]);

  // Preview grade computation in marks modal
  const previewTotalMarks = Number(marksFormData.internalMarks || 0) + Number(marksFormData.externalMarks || 0);
  let previewGrade = 'F';
  if (previewTotalMarks >= 90) previewGrade = 'O';
  else if (previewTotalMarks >= 80) previewGrade = 'A+';
  else if (previewTotalMarks >= 70) previewGrade = 'A';
  else if (previewTotalMarks >= 60) previewGrade = 'B+';
  else if (previewTotalMarks >= 50) previewGrade = 'B';
  else if (previewTotalMarks >= 40) previewGrade = 'C';

  // Columns for Faculty Directory Table (Admin view)
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
          {row.department?.name || '—'}
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
  if (isFacultyRole) {
    return (
      <div className="space-y-6">
        {/* 1. Header Banner */}
        <DashboardHeaderBanner
          title="Faculty Academic Portal"
          subtitle="Teaching schedules, period attendance registers, internal marks entry, and leave applications."
          academicYear="2026 – 2027"
        />

        {/* 2. 5-KPI Cards Row (Actual DB Values) */}
        {kpiError ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
            <span>Unable to refresh live KPI statistics: {kpiError}</span>
            <button
              onClick={() => loadData()}
              className="text-xs font-bold text-teal-700 underline hover:text-teal-900 ml-2"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <DashboardKPICard
            title="Total Students Taught"
            value={isKpiLoading ? '...' : (kpiStats?.totalStudentsTaught ?? totalStudentsCount)}
            icon={Users}
            trend="Active Cohort"
            trendDirection="up"
            color="emerald"
            onClick={() => setIsStudentsModalOpen(true)}
          />
          <DashboardKPICard
            title="Assigned Subjects"
            value={isKpiLoading ? '...' : (kpiStats?.assignedSubjects ?? mySubjects.length)}
            icon={BookOpen}
            trend="Curriculum"
            trendDirection="up"
            color="blue"
            onClick={() => setIsSubjectsModalOpen(true)}
          />
          <DashboardKPICard
            title="Weekly Classes"
            value={isKpiLoading ? '...' : `${kpiStats?.weeklyClasses ?? mySlots.length} Slots`}
            icon={Clock}
            trend="Academic Week"
            color="amber"
            onClick={() => setIsScheduleModalOpen(true)}
          />
          <DashboardKPICard
            title="Class Attendance"
            value={
              isKpiLoading
                ? '...'
                : kpiStats?.classAttendance
                ? (kpiStats.classAttendance.hasRecords ? `${kpiStats.classAttendance.percentage}%` : 'N/A')
                : (attendanceStats.percentage !== null ? `${attendanceStats.percentage}%` : 'N/A')
            }
            icon={CalendarCheck}
            trend={
              kpiStats?.classAttendance
                ? (kpiStats.classAttendance.hasRecords
                    ? (kpiStats.classAttendance.percentage >= 75 ? 'Healthy' : 'Needs Review')
                    : 'No Records')
                : (attendanceStats.percentage !== null && attendanceStats.percentage >= 75 ? 'Healthy' : 'Needs Review')
            }
            trendDirection={
              kpiStats?.classAttendance
                ? (kpiStats.classAttendance.hasRecords && kpiStats.classAttendance.percentage >= 75 ? 'up' : 'down')
                : (attendanceStats.percentage !== null && attendanceStats.percentage >= 75 ? 'up' : 'down')
            }
            color="rose"
            onClick={() => setIsMarkAttendanceOpen(true)}
          />
          <DashboardKPICard
            title="Leave Balance"
            value={
              isKpiLoading
                ? '...'
                : `${kpiStats?.leaveBalance?.remaining ?? leaveBalance} Days`
            }
            icon={ShieldCheck}
            trend={
              kpiStats?.leaveBalance?.pendingCount
                ? `${kpiStats.leaveBalance.pendingCount} Pending`
                : 'Available'
            }
            trendDirection="up"
            color="purple"
            onClick={() => {
              setLeaveSubTab('my-leaves');
              setFacultyActiveTab('leave');
              setIsApplyLeaveOpen(true);
            }}
          />
        </div>

        {/* 3. Analytics Row (Real Database Values & Dynamic Visualizations) */}
        <DashboardAnalyticsRow
          chartTitle="Weekly Attendance Average"
          enrollmentTrend={weeklyAttendanceTrend}
          donutTitle="Subject Teaching Load"
          totalCount={String(totalStudentsCount)}
          totalCountLabel="Students"
          deptDistribution={subjectDistribution}
          rangeOptions={['This Week', 'This Month', 'All Time']}
          selectedRange={attendanceRange}
          onRangeChange={(r) => setAttendanceRange(r)}
          quickActions={[
            { label: 'Mark Attendance', icon: CalendarCheck, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
            { label: 'Apply Leave', icon: Clock, color: 'bg-sky-50 text-sky-800 border-sky-200' },
            { label: 'Enter Marks', icon: Award, color: 'bg-amber-50 text-amber-800 border-amber-200' },
            { label: 'Timetable', icon: Calendar, color: 'bg-purple-50 text-purple-800 border-purple-200' }
          ]}
          onActionClick={(label) => {
            if (label === 'Mark Attendance') setIsMarkAttendanceOpen(true);
            else if (label === 'Apply Leave') {
              setLeaveSubTab('my-leaves');
              setFacultyActiveTab('leave');
              setIsApplyLeaveOpen(true);
            }
            else if (label === 'Enter Marks') {
              setFacultyActiveTab('marks');
              setIsMarksModalOpen(true);
            }
            else if (label === 'Timetable') setFacultyActiveTab('timetable');
          }}
        />

        {/* 4. Lower Widgets Row (Real DB Events, Real Activities, Real Notices, Navigable Calendar) */}
        <DashboardWidgetsRow
          upcomingEvents={formattedUpcomingEvents}
          recentActivities={facultyRecentActivities}
          notices={formattedNotices}
        />

        {/* 5. Modules Grid */}
        <DashboardModulesNav />

        {/* Navigation Tabs */}
        <div className="flex border-b border-navy-200 bg-white px-4 rounded-xl shadow-subtle overflow-x-auto">
          <button
            onClick={() => setFacultyActiveTab('timetable')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              facultyActiveTab === 'timetable'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Weekly Teaching Timetable ({mySlots.length})</span>
          </button>

          <button
            onClick={() => setFacultyActiveTab('courses')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              facultyActiveTab === 'courses'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Assigned Courses & Syllabus ({mySubjects.length})</span>
          </button>

          <button
            onClick={() => setFacultyActiveTab('roster')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              facultyActiveTab === 'roster'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Classroom Student Rosters ({myStudents.length})</span>
          </button>

          <button
            onClick={() => setFacultyActiveTab('exams')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              facultyActiveTab === 'exams'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Examinations & Assessments ({exams.length})</span>
          </button>

          <button
            onClick={() => setFacultyActiveTab('marks')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              facultyActiveTab === 'marks'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Marks Entry & Grading ({marksList.length})</span>
          </button>

          <button
            onClick={() => setFacultyActiveTab('leave')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              facultyActiveTab === 'leave'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Leave Management & Approvals</span>
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
                {mySlots.map((slot) => (
                  <div key={slot._id || slot.id} className="p-3.5 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-navy-950 block">{slot.subject?.name || 'Class Lecture'}</span>
                      <span className="text-[11px] text-navy-500 font-mono">
                        {slot.dayOfWeek?.toUpperCase()} &bull; Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="teal" size="xs">Room {slot.roomNumber || 'LH-101'}</Badge>
                      <span className="text-[10px] text-navy-500 block mt-1">Section {slot.section || 'A'} &bull; {slot.department?.name || myDeptName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 2: Courses */}
        {facultyActiveTab === 'courses' && (
          <Card
            title="Assigned Courses & Curriculum Syllabus"
            subtitle="Subject syllabus, course codes, and lecture credit allocations"
          >
            {mySubjects.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No curriculum subjects allocated.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mySubjects.map((sub) => (
                  <div key={sub._id || sub.id} className="p-3.5 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-navy-950 block">{sub.name}</span>
                      <span className="text-[11px] text-navy-500 font-mono">
                        Code: {sub.code} &bull; Semester {sub.semester}
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="navy" size="xs">{sub.credits} Credits</Badge>
                      <span className="text-[10px] text-navy-500 uppercase block mt-1">{sub.isLab ? 'Laboratory' : (sub.type || 'Theory')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 3: Student Roster */}
        {facultyActiveTab === 'roster' && (
          <Card
            title="Classroom Student Rosters"
            subtitle={`Enrolled undergraduate students in Department of ${myDeptName}`}
            headerAction={
              <Button variant="teal" size="xs" onClick={() => setIsMarkAttendanceOpen(true)} icon={CalendarCheck}>
                Mark Session Attendance
              </Button>
            }
          >
            {myStudents.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No student records enrolled in your department.</p>
            ) : (
              <div className="space-y-2">
                {myStudents.slice(0, 20).map((stud) => (
                  <div key={stud._id || stud.id} className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-teal-900 block">{stud.rollNumber}</span>
                      <span className="font-semibold text-navy-950 block">{stud.user?.name || 'Student'}</span>
                      <span className="text-[11px] text-navy-500 font-mono">{stud.user?.email}</span>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-navy-800 block">Semester {stud.currentSemester}</span>
                        <span className="text-[11px] text-navy-500 font-mono block">Batch {stud.batchYear}</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setAttendanceForm((prev) => ({
                            ...prev,
                            studentId: stud._id || stud.id
                          }));
                          setIsMarkAttendanceOpen(true);
                        }}
                      >
                        Mark
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 4: Exams */}
        {facultyActiveTab === 'exams' && (
          <Card
            title="Institutional Examinations & Assessment Information"
            subtitle="Scheduled mid-term and semester evaluation cycles"
            headerAction={
              <Button
                variant="teal"
                size="xs"
                onClick={() => setFacultyActiveTab('marks')}
              >
                Go to Marks Entry &rarr;
              </Button>
            }
          >
            {exams.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No examination cycles currently scheduled.</p>
            ) : (
              <div className="space-y-2">
                {exams.map((ex) => (
                  <div key={ex.id || ex._id} className="p-3.5 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-navy-950 block">{ex.name}</span>
                      <span className="text-[11px] text-navy-500 font-mono">
                        {ex.examType?.toUpperCase()} &bull; Semester {ex.semester} ({ex.academicYear})
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="teal" size="xs">{ex.timelineStatus || 'Scheduled'}</Badge>
                      <span className="text-[10px] text-navy-500 block mt-1">
                        {ex.isPublished ? 'Grades Published' : 'Evaluation Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 5: Marks Entry & Evaluation (Feature F) */}
        {facultyActiveTab === 'marks' && (
          <Card
            title="Student Marks Entry & Academic Grade Evaluation"
            subtitle="Enter, edit, and persist internal (Max 40) and external (Max 60) student marks to MongoDB"
            headerAction={
              <Button
                variant="teal"
                size="xs"
                onClick={() => {
                  setMarksFormData({
                    examination: exams[0]?._id || '',
                    subject: mySubjects[0]?._id || '',
                    student: myStudents[0]?._id || '',
                    internalMarks: 25,
                    externalMarks: 45,
                    status: 'passed'
                  });
                  setMarksFormError('');
                  setIsMarksModalOpen(true);
                }}
                icon={Plus}
              >
                Enter Student Marks
              </Button>
            }
          >
            {/* Marks Filters */}
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                id="search-marks"
                placeholder="Search by student name or roll..."
                value={marksSearchQuery}
                onChange={(e) => setMarksSearchQuery(e.target.value)}
                icon={Search}
              />

              <Select
                id="filter-marks-exam"
                value={marksFilterExam}
                onChange={(e) => setMarksFilterExam(e.target.value)}
                options={[
                  { value: '', label: 'All Examinations' },
                  ...exams.map((e) => ({ value: e._id || e.id, label: `${e.name} (${e.examType})` }))
                ]}
              />

              <Select
                id="filter-marks-subject"
                value={marksFilterSubject}
                onChange={(e) => setMarksFilterSubject(e.target.value)}
                options={[
                  { value: '', label: 'All Curriculum Subjects' },
                  ...mySubjects.map((s) => ({ value: s._id || s.id, label: `${s.name} (${s.code})` }))
                ]}
              />
            </div>

            {/* Marks Table */}
            {filteredMarks.length === 0 ? (
              <div className="py-8 text-center text-xs text-navy-400">
                <p>No evaluation records match the selected parameters.</p>
                <Button
                  variant="secondary"
                  size="xs"
                  className="mt-3"
                  onClick={() => setIsMarksModalOpen(true)}
                  icon={Plus}
                >
                  Enter First Record
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-navy-900 text-white font-semibold">
                      <th className="py-2.5 px-3">Roll Number</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3 text-center">Internal (40)</th>
                      <th className="py-2.5 px-3 text-center">External (60)</th>
                      <th className="py-2.5 px-3 text-center">Total (100)</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-100">
                    {filteredMarks.map((mk) => (
                      <tr key={mk._id || mk.id} className="hover:bg-navy-50/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-navy-950">
                          {mk.student?.rollNumber || 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-navy-900">
                          {mk.student?.user?.name || 'Student'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-navy-950 block">{mk.subject?.code}</span>
                          <span className="text-[10px] text-navy-500 block truncate max-w-xs">{mk.subject?.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-navy-800">{mk.internalMarks}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-navy-800">{mk.externalMarks}</td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-navy-950">{mk.totalMarks}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block w-7 py-0.5 text-center font-bold text-xs rounded ${
                              mk.grade === 'O' || mk.grade === 'A+' || mk.grade === 'A'
                                ? 'bg-emerald-100 text-emerald-800'
                                : mk.grade === 'F'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-teal-100 text-teal-800'
                            }`}
                          >
                            {mk.grade}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={mk.status === 'passed' ? 'teal' : 'rose'} size="xs">
                            {(mk.status || 'passed').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleOpenEditMarks(mk)}
                            icon={Edit2}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* TAB 6: Role-Based Leave Management & Student Approvals */}
        {facultyActiveTab === 'leave' && (
          <RoleLeaveManagement defaultTab={leaveSubTab || 'my-leaves'} />
        )}

        {/* Modal: Mark Attendance Session (Feature D) */}
        <Modal
          isOpen={isMarkAttendanceOpen}
          onClose={() => setIsMarkAttendanceOpen(false)}
          title="Submit Student Attendance Session"
          subtitle="Records period attendance compliance directly to MongoDB"
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsMarkAttendanceOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="teal" size="sm" onClick={handleMarkAttendanceSubmit} isLoading={isSubmitting}>
                Submit Attendance
              </Button>
            </>
          }
        >
          <form onSubmit={handleMarkAttendanceSubmit} className="space-y-4">
            {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

            <Select
              label="Curriculum Subject"
              id="att-subject"
              required
              value={attendanceForm.subject}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, subject: e.target.value })}
              options={mySubjects.map((s) => ({ value: s._id || s.id, label: `${s.name} (${s.code})` }))}
            />

            <Select
              label="Student"
              id="att-student"
              required
              value={attendanceForm.studentId}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, studentId: e.target.value })}
              options={[
                { value: '__ALL__', label: `All Enrolled Students in Session (${eligibleSubjectStudents.length})` },
                ...eligibleSubjectStudents.map((st) => ({
                  value: st._id || st.id,
                  label: `${st.rollNumber} - ${st.user?.name || 'Student'}`
                }))
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Session Date"
                id="att-date"
                type="date"
                required
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
              />
              <Select
                label="Period Slot"
                id="att-period"
                value={attendanceForm.periodNumber}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, periodNumber: e.target.value })}
                options={[
                  { value: '1', label: 'Period 1 (09:00 - 10:00)' },
                  { value: '2', label: 'Period 2 (10:00 - 11:00)' },
                  { value: '3', label: 'Period 3 (11:15 - 12:15)' },
                  { value: '4', label: 'Period 4 (12:15 - 01:15)' },
                  { value: '5', label: 'Period 5 (02:00 - 03:00)' },
                  { value: '6', label: 'Period 6 (03:00 - 04:00)' }
                ]}
              />
            </div>

            <Select
              label="Attendance Status"
              id="att-status"
              value={attendanceForm.status}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })}
              options={[
                { value: 'present', label: 'Present' },
                { value: 'absent', label: 'Absent' },
                { value: 'late', label: 'Late' },
                { value: 'excused', label: 'Excused' }
              ]}
            />

            <Input
              label="Session Remarks"
              id="att-remarks"
              value={attendanceForm.remarks}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, remarks: e.target.value })}
              placeholder="e.g. Unit 3 lecture covered"
            />
          </form>
        </Modal>

        {/* Modal: Apply for Faculty Leave (Feature E) */}
        <Modal
          isOpen={isApplyLeaveOpen}
          onClose={() => setIsApplyLeaveOpen(false)}
          title="Apply for Faculty Leave"
          subtitle="Submits an academic or casual leave application for administrative review"
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsApplyLeaveOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="teal" size="sm" onClick={handleApplyLeaveSubmit} isLoading={isSubmitting}>
                Submit Application
              </Button>
            </>
          }
        >
          <form onSubmit={handleApplyLeaveSubmit} className="space-y-4">
            {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

            <Select
              label="Leave Type"
              id="faculty-leave-type"
              required
              value={leaveForm.leaveType}
              onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
              options={[
                { value: 'casual', label: 'Casual Leave (CL)' },
                { value: 'sick', label: 'Sick / Medical Leave' },
                { value: 'duty', label: 'On Duty (OD) / Academic Conference' },
                { value: 'earned', label: 'Earned Leave' },
                { value: 'special_casual', label: 'Special Casual Leave' }
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Date"
                id="faculty-leave-start"
                type="date"
                required
                value={leaveForm.startDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
              />
              <Input
                label="End Date"
                id="faculty-leave-end"
                type="date"
                required
                value={leaveForm.endDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy-800 uppercase tracking-wider mb-1">
                Reason for Leave *
              </label>
              <textarea
                id="faculty-leave-reason"
                required
                rows={3}
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="State academic reason or purpose of leave..."
                className="w-full text-xs border border-navy-200 rounded-lg p-2.5 bg-white text-navy-800 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </form>
        </Modal>

        {/* Modal: Enter / Edit Student Marks (Feature F) */}
        <Modal
          isOpen={isMarksModalOpen}
          onClose={() => setIsMarksModalOpen(false)}
          title="Student Assessment Marks Entry"
          subtitle="Record internal and external evaluation grades directly to database"
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsMarksModalOpen(false)} disabled={isMarksSubmitting}>
                Cancel
              </Button>
              <Button variant="teal" size="sm" onClick={handleMarksSubmit} isLoading={isMarksSubmitting}>
                Save Marks
              </Button>
            </>
          }
        >
          <form onSubmit={handleMarksSubmit} className="space-y-4">
            {marksFormError && <Notification type="error" message={marksFormError} onClose={() => setMarksFormError('')} />}

            <Select
              label="Examination Cycle *"
              id="marks-exam"
              required
              value={marksFormData.examination}
              onChange={(e) => setMarksFormData({ ...marksFormData, examination: e.target.value })}
              options={exams.map((ex) => ({
                value: ex._id || ex.id,
                label: `${ex.name} (${ex.examType?.toUpperCase()})`
              }))}
            />

            <Select
              label="Curriculum Subject *"
              id="marks-subject"
              required
              value={marksFormData.subject}
              onChange={(e) => setMarksFormData({ ...marksFormData, subject: e.target.value })}
              options={mySubjects.map((s) => ({
                value: s._id || s.id,
                label: `${s.name} (${s.code})`
              }))}
            />

            <Select
              label="Student *"
              id="marks-student"
              required
              value={marksFormData.student}
              onChange={(e) => setMarksFormData({ ...marksFormData, student: e.target.value })}
              options={myStudents.map((st) => ({
                value: st._id || st.id,
                label: `${st.rollNumber} - ${st.user?.name || 'Student'}`
              }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Internal Marks (Max 40) *"
                id="marks-internal"
                type="number"
                min="0"
                max="40"
                required
                value={marksFormData.internalMarks}
                onChange={(e) => setMarksFormData({ ...marksFormData, internalMarks: e.target.value })}
              />
              <Input
                label="External Marks (Max 60) *"
                id="marks-external"
                type="number"
                min="0"
                max="60"
                required
                value={marksFormData.externalMarks}
                onChange={(e) => setMarksFormData({ ...marksFormData, externalMarks: e.target.value })}
              />
            </div>

            {/* Live Preview of Total & Computed Grade */}
            <div className="p-3 bg-warm-50 rounded-xl border border-navy-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-navy-500 font-medium block">Total Marks:</span>
                <span className="font-extrabold text-navy-950 text-base">{previewTotalMarks} / 100</span>
              </div>
              <div className="text-right">
                <span className="text-navy-500 font-medium block">Calculated Grade:</span>
                <Badge
                  variant={previewGrade === 'O' || previewGrade === 'A+' || previewGrade === 'A' ? 'teal' : previewGrade === 'F' ? 'rose' : 'navy'}
                  size="sm"
                >
                  Grade {previewGrade}
                </Badge>
              </div>
            </div>

            <Select
              label="Evaluation Status"
              id="marks-status"
              value={marksFormData.status}
              onChange={(e) => setMarksFormData({ ...marksFormData, status: e.target.value })}
              options={[
                { value: 'passed', label: 'Passed' },
                { value: 'failed', label: 'Failed' },
                { value: 'absent', label: 'Absent' },
                { value: 'withheld', label: 'Withheld' }
              ]}
            />
          </form>
        </Modal>
        {/* ========================================================= */}
        {/* DETAIL MODAL 1: Total Students Taught */}
        {/* ========================================================= */}
        <Modal
          isOpen={isStudentsModalOpen}
          onClose={() => setIsStudentsModalOpen(false)}
          title="Total Students Taught"
          subtitle={`Distinct undergraduate students enrolled in curriculum subjects taught by ${user?.name || 'Faculty'}`}
          maxWidth="max-w-4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-navy-500 font-medium">
                Total distinct students: <strong className="text-navy-950 font-bold">{kpiStats?.totalStudentsTaught ?? totalStudentsCount}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setIsStudentsModalOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Search and Count Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                <input
                  type="text"
                  placeholder="Search students by name, roll number, or subject..."
                  value={studentsModalSearch}
                  onChange={(e) => setStudentsModalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-navy-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <Badge variant="teal" size="sm">
                {(kpiStats?.details?.students || myStudents).length} Enrolled
              </Badge>
            </div>

            {/* Students Table / List */}
            {(() => {
              const baseList = (kpiStats?.details?.students && kpiStats.details.students.length > 0)
                ? kpiStats.details.students
                : myStudents.map((st) => {
                    const matching = mySubjects.filter((sub) => !sub.semester || Number(st.currentSemester) === Number(sub.semester));
                    return {
                      _id: st._id || st.id,
                      name: st.user?.name || 'Student',
                      email: st.user?.email || '',
                      rollNumber: st.rollNumber,
                      department: st.department?.name || myDeptName,
                      currentSemester: st.currentSemester,
                      assignedSubjects: matching.map((s) => ({ id: s._id || s.id, code: s.code, name: s.name }))
                    };
                  });

              const filtered = baseList.filter((st) => {
                if (!studentsModalSearch.trim()) return true;
                const q = studentsModalSearch.toLowerCase();
                const roll = (st.rollNumber || '').toLowerCase();
                const name = (st.name || '').toLowerCase();
                const dept = (st.department || '').toLowerCase();
                const subs = Array.isArray(st.assignedSubjects)
                  ? st.assignedSubjects.map((s) => `${s.code || ''} ${s.name || ''}`).join(' ').toLowerCase()
                  : '';
                return roll.includes(q) || name.includes(q) || dept.includes(q) || subs.includes(q);
              });

              if (filtered.length === 0) {
                return (
                  <div className="py-12 text-center bg-white rounded-xl border border-navy-100">
                    <Users className="w-10 h-10 text-navy-300 mx-auto mb-2.5" />
                    <p className="text-sm font-semibold text-navy-800">No Students Found</p>
                    <p className="text-xs text-navy-400 mt-0.5">
                      {studentsModalSearch.trim()
                        ? `No students matching "${studentsModalSearch}" in your assigned cohort.`
                        : 'No enrolled students found for your assigned curriculum subjects.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-warm-50/80 border-b border-navy-100 text-navy-600 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-3.5">Student Details</th>
                        <th className="py-3 px-3">Roll / ID Number</th>
                        <th className="py-3 px-3">Department</th>
                        <th className="py-3 px-3">Semester</th>
                        <th className="py-3 px-3.5">Assigned Subject(s)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-50">
                      {filtered.map((st) => (
                        <tr key={st._id} className="hover:bg-warm-50/40 transition-colors">
                          <td className="py-3 px-3.5">
                            <span className="font-semibold text-navy-950 block">{st.name}</span>
                            <span className="text-[11px] text-navy-500 font-light">{st.email || '—'}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-xs text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/70 inline-block">
                              {st.rollNumber}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-navy-700 font-medium">
                            {st.department}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="navy" size="xs">
                              Sem {st.currentSemester}
                            </Badge>
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(st.assignedSubjects) && st.assignedSubjects.length > 0 ? (
                                st.assignedSubjects.map((s) => (
                                  <Badge key={s.id || s.code} variant="teal" size="xs">
                                    {s.code || s.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-navy-400 text-xs italic">Department Curriculum</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </Modal>

        {/* ========================================================= */}
        {/* DETAIL MODAL 2: Assigned Subjects */}
        {/* ========================================================= */}
        <Modal
          isOpen={isSubjectsModalOpen}
          onClose={() => setIsSubjectsModalOpen(false)}
          title="Assigned Curriculum Subjects"
          subtitle={`Curriculum subjects, lecture credits, and classroom allotments allocated to ${user?.name || 'Faculty'}`}
          maxWidth="max-w-4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-navy-500 font-medium">
                Total assigned subjects: <strong className="text-navy-950 font-bold">{kpiStats?.assignedSubjects ?? mySubjects.length}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setIsSubjectsModalOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {(() => {
              const baseSubjects = (kpiStats?.details?.assignedSubjects && kpiStats.details.assignedSubjects.length > 0)
                ? kpiStats.details.assignedSubjects
                : mySubjects.map((sub) => {
                    const subSlots = mySlots.filter((slot) => {
                      const slotSubId = (slot.subject?._id || slot.subject?.id || slot.subject)?.toString();
                      return slotSubId === (sub._id || sub.id)?.toString();
                    });
                    return {
                      _id: sub._id || sub.id,
                      name: sub.name,
                      code: sub.code,
                      department: sub.department?.name || myDeptName,
                      semester: sub.semester,
                      credits: sub.credits || 3,
                      isLab: Boolean(sub.isLab),
                      classes: subSlots.map((s) => ({
                        dayOfWeek: s.dayOfWeek,
                        periodNumber: s.periodNumber,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        roomNumber: s.roomNumber || 'LH-101',
                        section: s.section || 'A'
                      }))
                    };
                  });

              if (baseSubjects.length === 0) {
                return (
                  <div className="py-12 text-center bg-white rounded-xl border border-navy-100">
                    <BookOpen className="w-10 h-10 text-navy-300 mx-auto mb-2.5" />
                    <p className="text-sm font-semibold text-navy-800">No Assigned Subjects</p>
                    <p className="text-xs text-navy-400 mt-0.5">
                      No curriculum subjects have been allocated to your profile yet.
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {baseSubjects.map((sub) => (
                    <div
                      key={sub._id}
                      className="p-4 rounded-xl bg-white border border-navy-100 shadow-2xs space-y-3 hover:border-teal-200 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/70 inline-block mb-1">
                            {sub.code}
                          </span>
                          <h4 className="text-sm font-bold text-navy-950">{sub.name}</h4>
                          <p className="text-[11px] text-navy-500">{sub.department}</p>
                        </div>
                        <div className="flex flex-col items-end space-y-1 shrink-0">
                          <Badge variant="teal" size="xs">
                            Sem {sub.semester}
                          </Badge>
                          <Badge variant={sub.isLab ? 'amber' : 'navy'} size="xs">
                            {sub.credits} Credits • {sub.isLab ? 'Laboratory' : 'Theory'}
                          </Badge>
                        </div>
                      </div>

                      {/* Associated Scheduled Class Details */}
                      <div className="pt-2 border-t border-navy-100/70">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-navy-500 block mb-1.5">
                          Weekly Scheduled Periods:
                        </span>
                        {Array.isArray(sub.classes) && sub.classes.length > 0 ? (
                          <div className="space-y-1">
                            {sub.classes.map((cls, idx) => (
                              <div
                                key={idx}
                                className="text-xs bg-warm-50 px-2.5 py-1.5 rounded-lg border border-navy-100/60 flex items-center justify-between text-navy-700"
                              >
                                <span className="font-semibold text-teal-900">
                                  {cls.dayOfWeek} (Period {cls.periodNumber})
                                </span>
                                <span className="text-[11px] text-navy-600">
                                  {cls.startTime} – {cls.endTime} • Room: <strong>{cls.roomNumber}</strong> • Sec {cls.section}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-navy-400 italic">No scheduled timetable periods allocated yet.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Modal>

        {/* ========================================================= */}
        {/* DETAIL MODAL 3: Weekly Classes (Schedule by Weekday) */}
        {/* ========================================================= */}
        <Modal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          title="Weekly Teaching Schedule"
          subtitle={`Complete period allotments, timings, and classroom venues for ${user?.name || 'Faculty'}`}
          maxWidth="max-w-4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-navy-500 font-medium">
                Total weekly classes: <strong className="text-navy-950 font-bold">{kpiStats?.weeklyClasses ?? mySlots.length} Slots</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setIsScheduleModalOpen(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {(() => {
              const baseSchedule = (kpiStats?.details?.weeklySchedule && kpiStats.details.weeklySchedule.length > 0)
                ? kpiStats.details.weeklySchedule
                : mySlots.map((s) => ({
                    _id: s._id || s.id,
                    dayOfWeek: s.dayOfWeek,
                    periodNumber: s.periodNumber,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    roomNumber: s.roomNumber || 'LH-101',
                    semester: s.semester,
                    section: s.section || 'A',
                    subject: {
                      id: s.subject?._id || s.subject?.id,
                      name: s.subject?.name || 'Curriculum Subject',
                      code: s.subject?.code || 'N/A'
                    }
                  }));

              if (baseSchedule.length === 0) {
                return (
                  <div className="py-12 text-center bg-white rounded-xl border border-navy-100">
                    <Clock className="w-10 h-10 text-navy-300 mx-auto mb-2.5" />
                    <p className="text-sm font-semibold text-navy-800">No Weekly Classes Scheduled</p>
                    <p className="text-xs text-navy-400 mt-0.5">
                      No teaching slots have been allotted to your faculty profile in the weekly timetable.
                    </p>
                  </div>
                );
              }

              const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const daysWithSlots = weekdays.filter((day) => baseSchedule.some((s) => s.dayOfWeek === day));

              return (
                <div className="space-y-3.5">
                  {daysWithSlots.map((day) => {
                    const daySlots = baseSchedule
                      .filter((s) => s.dayOfWeek === day)
                      .sort((a, b) => Number(a.periodNumber) - Number(b.periodNumber));

                    return (
                      <div key={day} className="rounded-xl border border-navy-100 bg-white overflow-hidden shadow-2xs">
                        <div className="px-4 py-2.5 bg-warm-50 border-b border-navy-100 flex items-center justify-between">
                          <span className="font-bold text-xs uppercase tracking-wider text-navy-900 flex items-center space-x-2">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            <span>{day}</span>
                          </span>
                          <Badge variant="teal" size="xs">
                            {daySlots.length} Period{daySlots.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="p-3 divide-y divide-navy-50">
                          {daySlots.map((slot) => (
                            <div
                              key={slot._id}
                              className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/80 text-xs shrink-0">
                                  Period {slot.periodNumber}
                                </span>
                                <div>
                                  <span className="font-bold text-navy-950 block">
                                    {slot.subject?.code} - {slot.subject?.name}
                                  </span>
                                  <span className="text-[11px] text-navy-500 font-medium">
                                    {slot.startTime} – {slot.endTime} • Room: <strong>{slot.roomNumber}</strong>
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                                <Badge variant="navy" size="xs">
                                  Sem {slot.semester} • Sec {slot.section || 'A'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Modal>
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
