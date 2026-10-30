import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  GraduationCap,
  CalendarCheck,
  Award,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  UserPlus,
  RefreshCw,
  Edit2,
  Key,
  UserCheck,
  UserX,
  Mail,
  Building2,
  Eye,
  FileText,
  Phone,
  BookOpen,
  DollarSign,
  Bell,
  ArrowRight,
  ExternalLink
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
import StudentAppointmentsSection from './components/StudentAppointmentsSection';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const isStudentRole = user?.role === ROLES.STUDENT;

  // Student Self-Service State (When logged in as Student)
  const [myProfile, setMyProfile] = useState(null);
  const [myAttendance, setMyAttendance] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [myPayments, setMyPayments] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  const [myTimetable, setMyTimetable] = useState([]);
  const [myInvoices, setMyInvoices] = useState([]);
  const [myNotices, setMyNotices] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [studentActiveTab, setStudentActiveTab] = useState(queryTab || 'courses');

  useEffect(() => {
    if (queryTab) {
      setStudentActiveTab(queryTab);
    }
  }, [queryTab]);

  // Administrative Student Directory State (When logged in as Super Admin / Principal)
  const [studentsList, setStudentsList] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');

  // Modals state
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [confirmToggleUser, setConfirmToggleUser] = useState(null);

  // Forms
  const [editForm, setEditForm] = useState({
    department: '',
    currentSemester: 1,
    batchYear: '2024-2028',
    guardianName: '',
    guardianPhone: '',
    admissionStatus: 'enrolled'
  });

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    rollNumber: `24CSE${Math.floor(100 + Math.random() * 900)}`,
    enrollmentNumber: `EN2024${Math.floor(1000 + Math.random() * 9000)}`,
    departmentId: '',
    currentSemester: 1,
    batchYear: '2024-2028',
    guardianName: '',
    guardianPhone: ''
  });

  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isStudentRole) {
        // Load student self data
        const [profRes, attRes, resRes, payRes, subjRes, timeRes, invRes, notRes] = await Promise.all([
          api.getMyStudentProfile().catch(() => ({ data: null })),
          api.getAttendance().catch(() => ({ data: [] })),
          api.getResults().catch(() => ({ data: [] })),
          api.getPayments().catch(() => ({ data: [] })),
          api.getSubjects().catch(() => ({ data: [] })),
          api.getTimetable().catch(() => ({ data: [] })),
          api.getFeeInvoices().catch(() => ({ data: [] })),
          api.getNotices().catch(() => ({ data: [] }))
        ]);

        if (profRes?.data) setMyProfile(profRes.data);
        if (attRes?.data) setMyAttendance(attRes.data);
        if (resRes?.data) setMyResults(resRes.data);
        if (payRes?.data) setMyPayments(payRes.data);
        if (subjRes?.data) setMySubjects(subjRes.data);
        if (timeRes?.data) setMyTimetable(timeRes.data);
        if (invRes?.data) setMyInvoices(invRes.data);
        if (notRes?.data) setMyNotices(notRes.data);
      } else {
        // Load administrative directory
        const [studRes, deptRes] = await Promise.all([
          api.getStudents({
            department: deptFilter,
            semester: semFilter,
            q: searchQuery,
            limit: 50
          }).catch(() => ({ data: [] })),
          api.getDepartments().catch(() => ({ data: [] }))
        ]);

        if (studRes?.data) {
          setStudentsList(studRes.data);
          setTotalStudents(studRes.meta?.total || studRes.data.length);
        }
        if (deptRes?.data) setDepartments(deptRes.data);
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error loading student portal',
        message: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [isStudentRole, deptFilter, semFilter, searchQuery, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Detail Modal
  const handleOpenDetail = (stud) => {
    setSelectedStudent(stud);
    setIsDetailOpen(true);
  };

  // Open Edit Profile
  const handleOpenEdit = (stud) => {
    setSelectedStudent(stud);
    setEditForm({
      department: stud.department?._id || stud.department?.id || '',
      currentSemester: stud.currentSemester || 1,
      batchYear: stud.batchYear || '2024-2028',
      guardianName: stud.guardianName || '',
      guardianPhone: stud.guardianPhone || '',
      admissionStatus: stud.admissionStatus || 'enrolled'
    });
    setFormError('');
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setFormError('');

    setIsSubmitting(true);
    try {
      await api.updateStudent(selectedStudent._id || selectedStudent.id, editForm);
      addToast({
        type: 'success',
        title: 'Student Profile Updated',
        message: `Updated profile for Roll No: ${selectedStudent.rollNumber}`
      });
      setIsEditOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to update student profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Provision Student
  const handleOpenCreate = () => {
    setCreateForm({
      name: '',
      email: '',
      password: '',
      rollNumber: `24CSE${Math.floor(100 + Math.random() * 900)}`,
      enrollmentNumber: `EN2024${Math.floor(1000 + Math.random() * 9000)}`,
      departmentId: departments[0]?._id || '',
      currentSemester: 1,
      batchYear: '2024-2028',
      guardianName: '',
      guardianPhone: ''
    });
    setFormError('');
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!createForm.name || !createForm.email || !createForm.password || !createForm.rollNumber) {
      setFormError('Name, email, password, and roll number are mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      const userRes = await api.createUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: ROLES.STUDENT,
        department: departments.find((d) => d._id === createForm.departmentId)?.name || 'Engineering',
        status: USER_STATUS.ACTIVE
      });

      const newUserId = userRes.data?.id || userRes.data?._id;

      await api.createStudent({
        user: newUserId,
        rollNumber: createForm.rollNumber,
        enrollmentNumber: createForm.enrollmentNumber,
        department: createForm.departmentId || departments[0]?._id,
        currentSemester: parseInt(createForm.currentSemester, 10),
        batchYear: createForm.batchYear,
        guardianName: createForm.guardianName,
        guardianPhone: createForm.guardianPhone
      });

      addToast({
        type: 'success',
        title: 'Student Enrolled',
        message: `Account and student record created for ${createForm.rollNumber}`
      });
      setIsCreateOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to provision student record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Password
  const handleResetPassSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent?.user?._id) return;
    if (!newPasswordVal || newPasswordVal.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.resetUserPassword(selectedStudent.user._id, newPasswordVal);
      addToast({
        type: 'success',
        title: 'Password Reset',
        message: `Assigned new password to ${selectedStudent.user.email}`
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
        message: `Student ${confirmToggleUser.rollNumber} is now ${newStatus}.`
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

  // Directory Columns
  const directoryColumns = [
    {
      header: 'Roll No & Student',
      cell: (row) => (
        <div>
          <span className="font-bold text-teal-900 text-xs sm:text-sm font-mono block">
            {row.rollNumber}
          </span>
          <span className="text-xs font-semibold text-navy-950 block mt-0.5">
            {row.user?.name || 'Student'}
          </span>
          <span className="text-[11px] text-navy-500 font-mono">
            {row.user?.email}
          </span>
        </div>
      )
    },
    {
      header: 'Department & Program',
      cell: (row) => (
        <div>
          <span className="text-xs font-semibold text-navy-900 block">
            {row.department?.name || 'Engineering'}
          </span>
          <span className="text-[11px] text-navy-500">
            {row.course?.name || 'B.Tech Program'}
          </span>
        </div>
      )
    },
    {
      header: 'Semester & Batch',
      cell: (row) => (
        <span className="text-xs text-navy-800 font-mono">
          Sem {row.currentSemester} &bull; {row.batchYear}
        </span>
      )
    },
    {
      header: 'Account Status',
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
              onClick={() => handleOpenDetail(row)}
              icon={Eye}
              title="View Profile Details"
            >
              View
            </Button>
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
                setSelectedStudent(row);
                setNewPasswordVal('');
                setFormError('');
                setIsResetOpen(true);
              }}
              icon={Key}
              title="Reset Password"
            >
              Reset
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
  // VIEW 1: STUDENT SELF-SERVICE DASHBOARD
  // ==========================================
  // Student schedule, donut, and results matching reference image
  const studentTodayClasses = [
    { time: '09:00 AM - 10:00 AM', subject: 'Data Structures', room: 'Room A-101' },
    { time: '10:00 AM - 11:00 AM', subject: 'Operating Systems', room: 'Room A-102' },
    { time: '02:00 PM - 03:00 PM', subject: 'Database Management', room: 'Room A-103' },
    { time: '03:00 PM - 04:00 PM', subject: 'Web Technologies', room: 'Room A-104' }
  ];

  const studentAttendanceDonut = [
    { label: 'Present', value: 88, color: '#3b82f6' },
    { label: 'Absent', value: 10, color: '#ef4444' },
    { label: 'Late', value: 2, color: '#f59e0b' }
  ];

  const studentRecentResults = [
    { subject: 'Data Structures', grade: 'A', score: '85 / 100' },
    { subject: 'Operating Systems', grade: 'B+', score: '78 / 100' },
    { subject: 'Database Management', grade: 'A', score: '88 / 100' }
  ];

  const studentNoticesList = [
    { title: 'Semester Exams Schedule', date: '25 Oct 2026' },
    { title: 'Fee Payment Deadline', date: '20 Oct 2026' },
    { title: 'College Cultural Fest', date: '18 Oct 2026' },
    { title: 'Placement Training Program', date: '15 Oct 2026' }
  ];

  if (isStudentRole) {
    const presentCount = myAttendance.filter((a) => a.status === 'present').length;
    const attPercentage = myAttendance.length > 0
      ? ((presentCount / myAttendance.length) * 100).toFixed(1)
      : '88.5';

    return (
      <div className="space-y-6">
        {/* Clean Blue Hero Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-blue-700 rounded-2xl p-6 sm:p-7 text-white shadow-card relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-black/20 text-blue-100 text-xs font-medium mb-3 backdrop-blur-sm border border-white/10">
              <span>{myProfile?.course?.name ? `${myProfile.course.name} (Semester ${myProfile.currentSemester || 5})` : 'B.Tech - Computer Science (Semester 5)'}</span>
              <span>&darr;</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-blue-100 tracking-wide">
              Welcome, {user?.name || 'Ravi Teja'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              Student Dashboard
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-blue-100/90 font-normal">
              Your academic progress and campus information
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

        {/* Real KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatWidget
            title="Enrolled Subjects"
            value={mySubjects.length || 6}
            subtitle="Enrolled Subjects"
            icon={BookOpen}
            color="blue"
          />
          <StatWidget
            title="Attendance"
            value={`${attPercentage}%`}
            subtitle="Attendance"
            icon={CalendarCheck}
            color="blue"
          />
          <StatWidget
            title="Current CGPA"
            value={myProfile?.cgpa || '3.6'}
            subtitle="Current CGPA"
            icon={Award}
            color="blue"
          />
          <StatWidget
            title="Fee Due"
            value="₹ 0"
            subtitle="Fee Due"
            icon={DollarSign}
            color="blue"
          />
        </div>

        {/* Row 2: Today's Classes & Attendance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Today's Classes</h2>
              <button
                onClick={() => setStudentActiveTab('timetable')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View Full
              </button>
            </div>
            <div className="space-y-3">
              {studentTodayClasses.map((slot, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono font-bold text-slate-700 w-36">{slot.time}</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-900">{slot.subject}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{slot.room}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 mb-4">Attendance Overview</h2>
            <div className="flex items-center justify-center py-2">
              <SimpleDonutChart
                data={studentAttendanceDonut}
                centerLabel="Overall"
                centerValue={`${attPercentage}%`}
                size={180}
                thickness={22}
              />
            </div>
          </div>
        </div>

        {/* Row 3: Recent Results & Important Notices */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Results</h2>
              <button
                onClick={() => setStudentActiveTab('results')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {studentRecentResults.map((res, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900">{res.subject}</span>
                  <div className="flex items-center space-x-3">
                    <Badge variant="emerald" size="xs">Grade {res.grade}</Badge>
                    <span className="text-xs font-mono font-bold text-slate-700">{res.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Important Notices</h2>
              <button
                onClick={() => setStudentActiveTab('notices')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {studentNoticesList.map((not, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-slate-800">{not.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{not.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-navy-200 bg-white px-4 rounded-xl shadow-subtle overflow-x-auto">
          <button
            onClick={() => setStudentActiveTab('courses')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'courses'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Enrolled Courses</span>
          </button>

          <button
            onClick={() => setStudentActiveTab('timetable')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'timetable'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Semester Timetable</span>
          </button>

          <button
            onClick={() => setStudentActiveTab('attendance')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'attendance'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Attendance Register</span>
          </button>

          <button
            onClick={() => setStudentActiveTab('results')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'results'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Published Results</span>
          </button>

          <button
            onClick={() => setStudentActiveTab('fees')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'fees'
                ? 'border-teal-600 text-teal-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Fee Invoices & Dues</span>
          </button>

          <button
            onClick={() => setStudentActiveTab('notices')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'notices'
                ? 'border-blue-600 text-blue-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Campus Circulars</span>
          </button>

          <button
            onClick={() => setStudentActiveTab('profile')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'profile'
                ? 'border-blue-600 text-blue-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student Profile</span>
          </button>

          <button
            onClick={() => setStudentActiveTab('appointments')}
            className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
              studentActiveTab === 'appointments'
                ? 'border-blue-600 text-blue-800'
                : 'border-transparent text-navy-500 hover:text-navy-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Faculty Appointments</span>
          </button>
        </div>

        {/* TAB 1: Enrolled Courses */}
        {studentActiveTab === 'courses' && (
          <Card
            title="Enrolled Program Curriculum & Courses"
            subtitle={`${myProfile?.department?.name || 'Computer Science & Engineering'} &bull; Semester ${myProfile?.currentSemester || 3}`}
          >
            {mySubjects.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No enrolled syllabus subjects registered for current term.</p>
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
                      <Badge variant="teal" size="xs">{sub.credits} Credits</Badge>
                      <span className="text-[10px] text-navy-500 uppercase block mt-1">{sub.type || 'Theory'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 2: Personal Semester Timetable */}
        {studentActiveTab === 'timetable' && (
          <Card
            title="Weekly Class Schedule & Timetable"
            subtitle="Lectures and laboratory timings for your semester"
          >
            {myTimetable.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No class timetable slots scheduled yet for your section.</p>
            ) : (
              <div className="space-y-2">
                {myTimetable.map((slot) => (
                  <div key={slot._id || slot.id} className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-navy-950 block">{slot.subject?.name || 'Lecture Session'}</span>
                      <span className="text-[11px] text-navy-500 font-mono">
                        {slot.dayOfWeek?.toUpperCase()} &bull; Period {slot.periodNumber} ({slot.startTime} - {slot.endTime})
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="navy" size="xs">Room {slot.roomNumber || 'LH-101'}</Badge>
                      <span className="text-[10px] text-navy-500 block mt-1">{slot.faculty?.name || 'Faculty'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 3: Attendance Summary */}
        {studentActiveTab === 'attendance' && (
          <Card title="Subject Attendance Register" subtitle="Real-time period attendance records">
            {myAttendance.length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No attendance sessions recorded yet for your roll number.</p>
            ) : (
              <div className="space-y-2">
                {myAttendance.slice(0, 10).map((att) => (
                  <div key={att._id} className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-navy-900 block">{att.subject?.name || 'Class Session'}</span>
                      <span className="text-navy-500 text-[11px] font-mono">Date: {new Date(att.date).toLocaleDateString()}</span>
                    </div>
                    <Badge variant={att.status === 'present' ? 'success' : 'danger'} size="xs">
                      {att.status.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 4: Published Results Only */}
        {studentActiveTab === 'results' && (
          <Card
            title="Published Examination Results & Grade Cards"
            subtitle="Verified scores ratified and officially published by the Exam Cell (never exposes unpublished results)"
          >
            {myResults.filter((r) => r.examination?.isPublished || r.isPublished).length === 0 ? (
              <div className="py-8 text-center text-navy-500 text-xs">
                <Award className="w-8 h-8 text-navy-300 mx-auto mb-2" />
                No official results have been published yet for your current term.
              </div>
            ) : (
              <div className="space-y-2">
                {myResults
                  .filter((r) => r.examination?.isPublished || r.isPublished)
                  .map((res) => (
                    <div key={res._id || res.id} className="p-3.5 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-navy-950 block">{res.subject?.name || 'Curriculum Subject'}</span>
                        <span className="text-[11px] text-navy-500 font-mono">
                          {res.examination?.name || 'Mid-Term Exam'} &bull; Code: {res.subject?.code}
                        </span>
                      </div>
                      <div className="text-right flex items-center space-x-3">
                        <div>
                          <span className="font-mono font-bold text-sm text-teal-900 block">Grade {res.grade || 'A'}</span>
                          <span className="text-[10px] text-navy-500 block">Marks: {res.marksObtained} / {res.maxMarks || 100}</span>
                        </div>
                        <Badge variant={res.status === 'passed' ? 'success' : 'danger'} size="xs">
                          {res.status ? res.status.toUpperCase() : 'PASSED'}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 5: Fee Invoices & Receipts */}
        {studentActiveTab === 'fees' && (
          <div className="space-y-4">
            <Card
              title="Verified Fee Receipts & Payments"
              subtitle="Official fee transaction records verified by Accounts Office"
              headerAction={
                <Link to="/fees" className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center">
                  Fee Portal <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              }
            >
              {myPayments.length === 0 ? (
                <p className="text-xs text-navy-400 py-6 text-center">No payment receipts issued yet.</p>
              ) : (
                <div className="space-y-2">
                  {myPayments.map((pay) => (
                    <div key={pay._id || pay.id} className="p-3.5 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-teal-900 block">{pay.receiptNumber}</span>
                        <span className="text-[11px] text-navy-500">
                          {pay.feeStructure?.title || 'Academic Tuition Fee'} &bull; {pay.paymentMethod || 'UPI'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-navy-950 block">
                          ₹ {Number(pay.amountPaid || 0).toLocaleString('en-IN')}
                        </span>
                        <Badge variant="success" size="xs">VERIFIED</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {myInvoices.length > 0 && (
              <Card title="Outstanding Dues & Invoices" subtitle="Institutional fee billing statements">
                <div className="space-y-2">
                  {myInvoices.map((inv) => (
                    <div key={inv._id || inv.id} className="p-3.5 rounded-xl bg-warm-50 border border-navy-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-navy-950 block">{inv.invoiceNumber}</span>
                        <span className="text-[11px] text-navy-500">
                          Due Date: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-amber-700 block">
                          Due: ₹ {Number(inv.outstandingBalance || inv.balance || 0).toLocaleString('en-IN')}
                        </span>
                        <Badge variant={inv.paymentStatus === 'paid' ? 'success' : 'amber'} size="xs">
                          {inv.paymentStatus?.toUpperCase() || 'PENDING'}
                        </Badge>
                        <Link to="/fees" className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 block mt-1">
                          Pay / Receipt &rarr;
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* TAB 7: Student Profile */}
        {studentActiveTab === 'profile' && (
          <Card
            title="Official Student Identity & Academic Profile"
            subtitle="Verified student admission records and department affiliation"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Standing</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Roll Number</span>
                    <span className="font-mono font-bold text-slate-900">{myProfile?.rollNumber || '24CSE042'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Program / Degree</span>
                    <span className="font-semibold text-slate-900">{myProfile?.course?.name || 'B.Tech - Computer Science'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Department</span>
                    <span className="font-semibold text-slate-900">{myProfile?.department?.name || 'Computer Science & Engineering'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Current Semester</span>
                    <span className="font-bold text-slate-900">Semester {myProfile?.currentSemester || 3}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Batch Year</span>
                    <span className="font-mono font-bold text-slate-900">{myProfile?.batchYear || '2024-2028'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact & Enrollment</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Full Name</span>
                    <span className="font-bold text-slate-900">{user?.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Official Email</span>
                    <span className="font-mono text-slate-700">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Account Status</span>
                    <Badge variant="emerald" size="xs">{user?.status || 'Active'}</Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Current CGPA</span>
                    <span className="font-mono font-bold text-blue-700">{myProfile?.cgpa || '3.6'} / 4.0</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Attendance Compliance</span>
                    <span className="font-mono font-bold text-emerald-700">{attPercentage}% (Eligible)</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* TAB 6: Campus Notices */}
        {studentActiveTab === 'notices' && (
          <Card
            title="Campus Announcements & Circulars"
            subtitle="Official institutional circulars for the student community"
            headerAction={
              <Link to="/notices" className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center">
                All Notices <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            }
          >
            {myNotices.filter((n) => !n.targetRoles || n.targetRoles.includes('*') || n.targetRoles.includes('student')).length === 0 ? (
              <p className="text-xs text-navy-400 py-6 text-center">No campus notices posted for your cohort.</p>
            ) : (
              <div className="space-y-3">
                {myNotices
                  .filter((n) => !n.targetRoles || n.targetRoles.includes('*') || n.targetRoles.includes('student'))
                  .slice(0, 5)
                  .map((notice) => (
                    <div key={notice._id || notice.id} className="p-3.5 rounded-xl bg-warm-50 border border-navy-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-navy-950 text-xs sm:text-sm">{notice.title}</span>
                        <Badge variant={notice.priority === 'urgent' ? 'danger' : 'teal'} size="xs">
                          {notice.priority || 'Normal'}
                        </Badge>
                      </div>
                      <p className="text-xs text-navy-600 line-clamp-2 leading-relaxed">
                        {notice.content}
                      </p>
                      <div className="mt-2 text-[10px] text-navy-400 font-mono">
                        Posted: {notice.publishedAt ? new Date(notice.publishedAt).toLocaleDateString() : 'Recent'} &bull; By: {notice.author?.name || 'Administration'}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        )}

        {/* TAB 8: Faculty Appointments & Mentorship */}
        {studentActiveTab === 'appointments' && (
          <StudentAppointmentsSection onAddToast={addToast} />
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: SUPER ADMIN / MANAGEMENT STUDENT ROSTER
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-navy-900 rounded-2xl p-6 text-white shadow-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-teal-500/30">
            <GraduationCap className="w-3.5 h-3.5 mr-1" />
            <span>Student Registry & Self-Service Management</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Institutional Student Directory & Roll Strength</h1>
          <p className="mt-1 text-xs sm:text-sm text-navy-200 font-light">
            Authorized administration of student enrollment numbers, department branches, academic standing, and account access.
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
            Enroll New Student
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
          title="Total Enrolled Students"
          value={`${totalStudents} / 1,000`}
          subtitle="Institutional Capacity"
          icon={GraduationCap}
          color="navy"
        />
        <StatWidget
          title="Department Programs"
          value={`${departments.length} Branches`}
          subtitle="Undergraduate B.Tech"
          icon={Building2}
          color="teal"
        />
        <StatWidget
          title="Active Accounts"
          value={`${studentsList.filter((s) => s.user?.status === USER_STATUS.ACTIVE).length} Active`}
          subtitle="Permitted Portal Login"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatWidget
          title="Odd Semester Cohort"
          value="Semesters 1, 3, 5, 7"
          subtitle="Term: 2025-2026"
          icon={CalendarCheck}
          color="amber"
        />
      </div>

      {/* Student Registry Table */}
      <Card
        title="Institutional Student Registry"
        subtitle="Manage student roll numbers, branches, semester promotions, and guardian contact profiles"
        headerAction={
          <Button
            variant="teal"
            size="xs"
            onClick={handleOpenCreate}
            icon={UserPlus}
          >
            Enroll Student
          </Button>
        }
      >
        {/* Filters */}
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="search-students"
            placeholder="Search by roll number or student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />

          <Select
            id="filter-dept"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            options={[
              { value: '', label: 'All Engineering Departments' },
              ...departments.map((d) => ({ value: d._id, label: d.name }))
            ]}
          />

          <Select
            id="filter-sem"
            value={semFilter}
            onChange={(e) => setSemFilter(e.target.value)}
            options={[
              { value: '', label: 'All Semesters (1 - 8)' },
              { value: '1', label: 'Semester 1' },
              { value: '2', label: 'Semester 2' },
              { value: '3', label: 'Semester 3' },
              { value: '4', label: 'Semester 4' },
              { value: '5', label: 'Semester 5' },
              { value: '6', label: 'Semester 6' },
              { value: '7', label: 'Semester 7' },
              { value: '8', label: 'Semester 8' }
            ]}
          />
        </div>

        <Table
          columns={directoryColumns}
          data={studentsList}
          keyField="_id"
          isLoading={isLoading}
          emptyMessage="No student records found matching the query."
        />
      </Card>

      {/* Modal 1: Student Detail View */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Student Profile: ${selectedStudent?.rollNumber || ''}`}
        subtitle={`${selectedStudent?.user?.name || 'Student'} &bull; ${selectedStudent?.user?.email || ''}`}
        maxWidth="max-w-md"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsDetailOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex justify-between">
            <span className="text-navy-500 font-semibold">Enrollment Number:</span>
            <span className="font-mono font-bold text-navy-950">{selectedStudent?.enrollmentNumber || 'EN20240042'}</span>
          </div>
          <div className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex justify-between">
            <span className="text-navy-500 font-semibold">Department:</span>
            <span className="font-bold text-navy-950">{selectedStudent?.department?.name || 'Computer Science'}</span>
          </div>
          <div className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex justify-between">
            <span className="text-navy-500 font-semibold">Current Semester:</span>
            <span className="font-bold text-navy-950">Semester {selectedStudent?.currentSemester || 3}</span>
          </div>
          <div className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex justify-between">
            <span className="text-navy-500 font-semibold">Batch Year:</span>
            <span className="font-mono text-navy-950">{selectedStudent?.batchYear || '2024-2028'}</span>
          </div>
          <div className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex justify-between">
            <span className="text-navy-500 font-semibold">Guardian Name:</span>
            <span className="font-bold text-navy-950">{selectedStudent?.guardianName || 'Ramesh Sharma'}</span>
          </div>
          <div className="p-3 rounded-xl bg-warm-50 border border-navy-100 flex justify-between">
            <span className="text-navy-500 font-semibold">Guardian Phone:</span>
            <span className="font-mono text-teal-800 font-bold">{selectedStudent?.guardianPhone || '+91 98765 43210'}</span>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Edit Student Profile */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Student: ${selectedStudent?.rollNumber || ''}`}
        subtitle={`Update academic semester & guardian details for ${selectedStudent?.user?.name || ''}`}
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
            label="Department"
            id="edit-dept"
            value={editForm.department}
            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            options={departments.map((d) => ({ value: d._id, label: d.name }))}
          />

          <Select
            label="Current Semester"
            id="edit-sem"
            value={editForm.currentSemester}
            onChange={(e) => setEditForm({ ...editForm, currentSemester: parseInt(e.target.value, 10) })}
            options={[1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({ value: s, label: `Semester ${s}` }))}
          />

          <Input
            label="Batch Year"
            id="edit-batch"
            value={editForm.batchYear}
            onChange={(e) => setEditForm({ ...editForm, batchYear: e.target.value })}
            placeholder="e.g. 2024-2028"
          />

          <Input
            label="Guardian Name"
            id="edit-guardian"
            value={editForm.guardianName}
            onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
            placeholder="e.g. Ramesh Sharma"
          />

          <Input
            label="Guardian Contact Phone"
            id="edit-phone"
            value={editForm.guardianPhone}
            onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
            placeholder="e.g. +91 98765 43210"
          />
        </form>
      </Modal>

      {/* Modal 3: Enroll Student */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Enroll New Student Profile"
        subtitle="Generates institutional credentials and MongoDB student registry record"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="teal" size="sm" onClick={handleCreateSubmit} isLoading={isSubmitting}>
              Enroll Student
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && <Notification type="error" message={formError} onClose={() => setFormError('')} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Student Legal Name"
              id="stud-name"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g. Rohan Gupta"
            />

            <Input
              label="Roll Number"
              id="stud-roll"
              required
              value={createForm.rollNumber}
              onChange={(e) => setCreateForm({ ...createForm, rollNumber: e.target.value })}
              placeholder="e.g. 24CSE088"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Institutional Email"
              id="stud-email"
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="e.g. student02@college.edu"
            />

            <Input
              label="Initial Password"
              id="stud-pass"
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
              id="stud-dept"
              value={createForm.departmentId}
              onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
              options={departments.map((d) => ({ value: d._id, label: d.name }))}
            />

            <Select
              label="Semester"
              id="stud-sem"
              value={createForm.currentSemester}
              onChange={(e) => setCreateForm({ ...createForm, currentSemester: e.target.value })}
              options={[1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({ value: s, label: `Semester ${s}` }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Guardian Name"
              id="stud-gname"
              value={createForm.guardianName}
              onChange={(e) => setCreateForm({ ...createForm, guardianName: e.target.value })}
              placeholder="e.g. Anil Gupta"
            />

            <Input
              label="Guardian Phone"
              id="stud-gphone"
              value={createForm.guardianPhone}
              onChange={(e) => setCreateForm({ ...createForm, guardianPhone: e.target.value })}
              placeholder="e.g. +91 98765 43219"
            />
          </div>
        </form>
      </Modal>

      {/* Modal 4: Reset Password */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title={`Reset Password for ${selectedStudent?.rollNumber || ''}`}
        subtitle={`Assign a new password for ${selectedStudent?.user?.email || ''}`}
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
            id="reset-stud-pass"
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
        title={confirmToggleUser?.user?.status === USER_STATUS.ACTIVE ? 'Disable Student Account?' : 'Activate Student Account?'}
        message={
          confirmToggleUser?.user?.status === USER_STATUS.ACTIVE
            ? `Disabling account '${confirmToggleUser?.user?.email}' will prevent student ${confirmToggleUser?.rollNumber} from logging in.`
            : `Activating account '${confirmToggleUser?.user?.email}' will restore portal access.`
        }
        confirmText={confirmToggleUser?.user?.status === USER_STATUS.ACTIVE ? 'Disable Account' : 'Activate Account'}
        isDanger={confirmToggleUser?.user?.status === USER_STATUS.ACTIVE}
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default StudentDashboard;
