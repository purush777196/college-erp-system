import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  MapPin,
  Video,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Edit2,
  Trash2,
  RotateCcw,
  FileText,
  Sliders,
  Check,
  X,
  BookOpen,
  CalendarDays,
  User,
  Phone,
  Mail,
  Building2,
  Sparkles,
  Info
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import api from '../../../api/apiClient';

const APPOINTMENT_TYPE_LABELS = {
  academic_doubt: 'Academic Doubt Clarification',
  assignment_discussion: 'Assignment Discussion',
  exam_prep: 'Examination Preparation',
  project_guidance: 'Project Guidance',
  research_discussion: 'Research Discussion',
  career_guidance: 'Career Guidance',
  mentoring: 'Mentoring',
  other: 'Other Academic Discussion'
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getStatusBadge(status) {
  switch (status) {
    case 'approved':
      return <Badge variant="success" size="xs">Approved</Badge>;
    case 'pending':
      return <Badge variant="warning" size="xs">Pending Review</Badge>;
    case 'rescheduled':
      return <Badge variant="indigo" size="xs">Rescheduled</Badge>;
    case 'completed':
      return <Badge variant="teal" size="xs">Completed</Badge>;
    case 'cancelled':
      return <Badge variant="danger" size="xs">Cancelled</Badge>;
    case 'rejected':
      return <Badge variant="danger" size="xs">Rejected</Badge>;
    case 'no_show':
      return <Badge variant="neutral" size="xs">No Show</Badge>;
    default:
      return <Badge variant="neutral" size="xs">{status}</Badge>;
  }
}

export const StudentAppointmentSection = ({
  assignedSubjects = [],
  onAddToast = () => {}
}) => {
  // Active navigation tab inside appointment section: 'pending' | 'upcoming' | 'today' | 'calendar' | 'history'
  const [activeSubTab, setActiveSubTab] = useState('pending');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Appointment Data states
  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: itemsPerPage, totalPages: 1 });
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    today: 0,
    completed: 0,
    cancelledOrRejected: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calendar view states
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [calendarData, setCalendarData] = useState({ appointments: [], timetableSlots: [], unavailableDates: [] });
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // Availability Management states
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [availabilityConfig, setAvailabilityConfig] = useState(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  // Action Modals State
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form states for modals
  const [approveForm, setApproveForm] = useState({ location: '', meetingUrl: '', note: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleForm, setRescheduleForm] = useState({ newDate: '', newStartTime: '', newEndTime: '', reason: '' });
  const [notesForm, setNotesForm] = useState({
    privateSummary: '',
    discussionTopics: '',
    actionItems: '',
    followUpRequired: false,
    followUpDate: ''
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Appointment Summary Stats
  const loadSummaryStats = useCallback(async () => {
    try {
      const res = await api.getFacultyAppointmentSummary();
      if (res?.data) {
        setSummaryStats(res.data);
      }
    } catch (err) {
      console.warn('Failed to load appointment summary stats:', err.message);
    }
  }, []);

  // Load Appointments for current tab
  const loadAppointments = useCallback(async () => {
    if (activeSubTab === 'calendar') return;
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        appointmentType: selectedType || undefined
      };

      if (activeSubTab === 'pending') {
        params.status = 'pending';
      } else if (activeSubTab === 'upcoming') {
        params.status = 'upcoming';
      } else if (activeSubTab === 'today') {
        params.status = 'today';
      } else if (activeSubTab === 'history') {
        params.status = 'completed'; // or history includes completed, cancelled, rejected
      }

      const res = await api.getFacultyAppointments(params);
      if (res?.data) {
        setAppointments(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
      onAddToast('Failed to load appointments: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeSubTab, currentPage, debouncedSearch, selectedType, itemsPerPage, onAddToast]);

  // Load Calendar Data
  const loadCalendarData = useCallback(async () => {
    if (activeSubTab !== 'calendar') return;
    setIsLoadingCalendar(true);
    try {
      const res = await api.getFacultyCalendarAppointments({ month: calendarMonth });
      if (res?.data) {
        setCalendarData(res.data);
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
      onAddToast('Failed to load calendar data', 'error');
    } finally {
      setIsLoadingCalendar(false);
    }
  }, [activeSubTab, calendarMonth, onAddToast]);

  useEffect(() => {
    loadSummaryStats();
  }, [loadSummaryStats]);

  useEffect(() => {
    if (activeSubTab === 'calendar') {
      loadCalendarData();
    } else {
      loadAppointments();
    }
  }, [activeSubTab, loadAppointments, loadCalendarData]);

  // Refresh current view
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSummaryStats();
    if (activeSubTab === 'calendar') {
      loadCalendarData();
    } else {
      loadAppointments();
    }
  };

  // Open Availability Manager Modal
  const handleOpenAvailability = async () => {
    setIsAvailabilityModalOpen(true);
    setIsLoadingAvailability(true);
    try {
      const res = await api.getFacultyAvailability();
      if (res?.data) {
        setAvailabilityConfig(res.data);
      }
    } catch (err) {
      console.error('Failed to load availability:', err);
      onAddToast('Could not load availability settings', 'error');
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  // Save Availability Settings
  const handleSaveAvailability = async () => {
    if (!availabilityConfig) return;
    setIsSavingAvailability(true);
    try {
      await api.updateFacultyAvailability(availabilityConfig);
      onAddToast('Availability settings updated successfully!', 'success');
      setIsAvailabilityModalOpen(false);
      handleRefresh();
    } catch (err) {
      console.error('Failed to save availability:', err);
      onAddToast(err.message || 'Failed to save availability settings', 'error');
    } finally {
      setIsSavingAvailability(false);
    }
  };

  // Open Approve Modal
  const handleOpenApprove = (appointment) => {
    setActiveAppointment(appointment);
    setApproveForm({
      location: appointment.location || 'Faculty Cabin',
      meetingUrl: appointment.meetingUrl || '',
      note: ''
    });
    setActionError('');
    setIsApproveModalOpen(true);
  };

  // Submit Approve
  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!activeAppointment) return;
    setIsSubmittingAction(true);
    setActionError('');
    try {
      await api.approveAppointment(activeAppointment._id, approveForm);
      onAddToast('Appointment request approved successfully!', 'success');
      setIsApproveModalOpen(false);
      loadSummaryStats();
      loadAppointments();
    } catch (err) {
      setActionError(err.message || 'Failed to approve appointment.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Open Reject Modal
  const handleOpenReject = (appointment) => {
    setActiveAppointment(appointment);
    setRejectReason('');
    setActionError('');
    setIsRejectModalOpen(true);
  };

  // Submit Reject
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!activeAppointment) return;
    setIsSubmittingAction(true);
    setActionError('');
    try {
      await api.rejectAppointment(activeAppointment._id, { reason: rejectReason });
      onAddToast('Appointment request rejected.', 'info');
      setIsRejectModalOpen(false);
      loadSummaryStats();
      loadAppointments();
    } catch (err) {
      setActionError(err.message || 'Failed to reject appointment.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Open Reschedule Modal
  const handleOpenReschedule = (appointment) => {
    setActiveAppointment(appointment);
    setRescheduleForm({
      newDate: appointment.date || '',
      newStartTime: appointment.startTime || '',
      newEndTime: appointment.endTime || '',
      reason: ''
    });
    setActionError('');
    setIsRescheduleModalOpen(true);
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!activeAppointment) return;
    if (!rescheduleForm.newDate || !rescheduleForm.newStartTime || !rescheduleForm.newEndTime) {
      setActionError('Please specify date, start time, and end time.');
      return;
    }
    setIsSubmittingAction(true);
    setActionError('');
    try {
      await api.rescheduleAppointment(activeAppointment._id, rescheduleForm);
      onAddToast('Appointment rescheduled successfully!', 'success');
      setIsRescheduleModalOpen(false);
      loadSummaryStats();
      loadAppointments();
    } catch (err) {
      setActionError(err.message || 'Failed to reschedule appointment.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Open Cancel Modal
  const handleOpenCancel = (appointment) => {
    setActiveAppointment(appointment);
    setCancelReason('');
    setActionError('');
    setIsCancelModalOpen(true);
  };

  // Submit Cancel
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!activeAppointment) return;
    setIsSubmittingAction(true);
    setActionError('');
    try {
      await api.cancelAppointment(activeAppointment._id, { reason: cancelReason });
      onAddToast('Appointment cancelled.', 'info');
      setIsCancelModalOpen(false);
      loadSummaryStats();
      loadAppointments();
    } catch (err) {
      setActionError(err.message || 'Failed to cancel appointment.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Mark Completed / No Show
  const handleMarkComplete = async (appointment, isNoShow = false) => {
    try {
      await api.completeAppointment(appointment._id, { isNoShow });
      onAddToast(isNoShow ? 'Marked as student no-show.' : 'Appointment completed successfully!', 'success');
      loadSummaryStats();
      loadAppointments();
    } catch (err) {
      onAddToast(err.message || 'Failed to update status', 'error');
    }
  };

  // Open Notes Modal
  const handleOpenNotes = (appointment) => {
    setActiveAppointment(appointment);
    const existing = appointment.meetingNotes || {};
    setNotesForm({
      privateSummary: existing.privateSummary || '',
      discussionTopics: Array.isArray(existing.discussionTopics) ? existing.discussionTopics.join(', ') : '',
      actionItems: Array.isArray(existing.actionItems) ? existing.actionItems.join(', ') : '',
      followUpRequired: Boolean(existing.followUpRequired),
      followUpDate: existing.followUpDate || ''
    });
    setActionError('');
    setIsNotesModalOpen(true);
  };

  // Submit Notes
  const handleNotesSubmit = async (e) => {
    e.preventDefault();
    if (!activeAppointment) return;
    setIsSubmittingAction(true);
    setActionError('');
    try {
      const payload = {
        privateSummary: notesForm.privateSummary,
        discussionTopics: notesForm.discussionTopics ? notesForm.discussionTopics.split(',').map(s => s.trim()).filter(Boolean) : [],
        actionItems: notesForm.actionItems ? notesForm.actionItems.split(',').map(s => s.trim()).filter(Boolean) : [],
        followUpRequired: notesForm.followUpRequired,
        followUpDate: notesForm.followUpDate
      };
      await api.saveAppointmentNotes(activeAppointment._id, payload);
      onAddToast('Private meeting notes recorded successfully!', 'success');
      setIsNotesModalOpen(false);
      loadAppointments();
    } catch (err) {
      setActionError(err.message || 'Failed to save notes.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = (appointment) => {
    setActiveAppointment(appointment);
    setIsDetailsModalOpen(true);
  };

  // Calendar Month Navigation
  const handleMonthChange = (delta) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setCalendarMonth(newMonthStr);
  };

  // Computed days for Calendar Grid
  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(dateStr);
    }
    return days;
  }, [calendarMonth]);

  return (
    <div className="space-y-6">
      {/* 1. SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-800">Student Appointment System</h2>
            <Badge variant="purple" size="xs">Phase 5</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review incoming student booking requests, manage weekly consultation availability, and track academic mentoring sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAvailability}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Sliders className="w-4 h-4" />
            <span>Manage Availability</span>
          </Button>
        </div>
      </div>

      {/* 2. DYNAMIC KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total</p>
            <h3 className="text-xl font-bold text-slate-800 mt-0.5">{summaryStats.total}</h3>
            <span className="text-[10px] text-slate-400">All bookings</span>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Pending</p>
            <h3 className="text-xl font-bold text-amber-600 mt-0.5">{summaryStats.pending}</h3>
            <span className="text-[10px] text-amber-600 font-medium">Needs review</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Approved</p>
            <h3 className="text-xl font-bold text-emerald-600 mt-0.5">{summaryStats.approved}</h3>
            <span className="text-[10px] text-emerald-600 font-medium">Scheduled</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Today</p>
            <h3 className="text-xl font-bold text-purple-700 mt-0.5">{summaryStats.today}</h3>
            <span className="text-[10px] text-purple-600 font-medium">Today's slots</span>
          </div>
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <CalendarDays className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Completed</p>
            <h3 className="text-xl font-bold text-teal-600 mt-0.5">{summaryStats.completed}</h3>
            <span className="text-[10px] text-slate-400">Past meetings</span>
          </div>
          <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Cancelled</p>
            <h3 className="text-xl font-bold text-slate-600 mt-0.5">{summaryStats.cancelledOrRejected}</h3>
            <span className="text-[10px] text-slate-400">Rejected / No show</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
            <UserX className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION SUB-TABS */}
      <div className="flex border-b border-slate-200 bg-white px-3 rounded-xl shadow-sm overflow-x-auto">
        <button
          onClick={() => { setActiveSubTab('pending'); setCurrentPage(1); }}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'pending'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Pending Requests ({summaryStats.pending})</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('upcoming'); setCurrentPage(1); }}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'upcoming'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Upcoming Appointments</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('today'); setCurrentPage(1); }}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'today'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-purple-600" />
          <span>Today's Schedule ({summaryStats.today})</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('calendar'); }}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'calendar'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>Appointment Calendar</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('history'); setCurrentPage(1); }}
          className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap cursor-pointer ${
            activeSubTab === 'history'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>Appointment History</span>
        </button>
      </div>

      {/* 4. SEARCH & FILTER CONTROLS (for list views) */}
      {activeSubTab !== 'calendar' && (
        <Card className="p-3.5 border-slate-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, roll number, title, or keywords..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
                className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">All Appointment Types</option>
                {Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {(searchQuery || selectedType) && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => { setSearchQuery(''); setSelectedType(''); setCurrentPage(1); }}
                  className="text-rose-600 hover:bg-rose-50"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 5. VIEW CONTENT */}
      {activeSubTab === 'calendar' ? (
        /* CALENDAR VIEW */
        <Card className="p-5 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                {new Date(calendarMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <Badge variant="purple" size="xs">Faculty Calendar</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleMonthChange(-1)}
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Prev Month
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setCalendarMonth(new Date().toISOString().substring(0, 7))}
              >
                Today
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleMonthChange(1)}
              >
                Next Month
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>

          {isLoadingCalendar ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mb-2" />
              <p className="text-xs text-slate-500">Loading calendar schedule...</p>
            </div>
          ) : (
            <div>
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 py-2 border-b border-slate-100">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {calendarDays.map((dateStr, idx) => {
                  if (!dateStr) {
                    return <div key={`empty-${idx}`} className="min-h-[90px] bg-slate-50/50 rounded-lg" />;
                  }

                  const dayNum = parseInt(dateStr.split('-')[2], 10);
                  const isToday = dateStr === new Date().toISOString().split('T')[0];

                  // Filter appointments for this date
                  const dayApps = calendarData.appointments.filter(a => a.date === dateStr);
                  const isUnavailable = calendarData.unavailableDates.some(u => u.date === dateStr);

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[90px] p-1.5 rounded-lg border transition ${
                        isToday
                          ? 'border-purple-400 bg-purple-50/30'
                          : isUnavailable
                          ? 'border-rose-200 bg-rose-50/20'
                          : 'border-slate-100 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span className={isToday ? 'px-1.5 py-0.5 rounded-full bg-purple-600 text-white' : ''}>
                          {dayNum}
                        </span>
                        {isUnavailable && (
                          <span className="text-[9px] text-rose-600 font-bold">Unavailable</span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayApps.slice(0, 2).map(app => (
                          <div
                            key={app._id}
                            onClick={() => handleOpenDetails(app)}
                            className={`p-1 rounded text-[10px] font-medium truncate cursor-pointer transition ${
                              app.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : app.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                            }`}
                            title={`${app.startTime} - ${app.title} (${app.student?.user?.name || 'Student'})`}
                          >
                            <span className="font-bold">{app.startTime}</span> {app.student?.user?.name || 'Student'}
                          </div>
                        ))}
                        {dayApps.length > 2 && (
                          <span className="text-[10px] text-slate-500 font-semibold pl-1">
                            +{dayApps.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      ) : isLoading ? (
        /* LOADING STATE */
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading appointments...</p>
        </div>
      ) : appointments.length === 0 ? (
        /* EMPTY STATE */
        <div className="py-16 px-4 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="p-4 rounded-full bg-purple-50 text-purple-600 mb-3">
            <CalendarDays className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {activeSubTab === 'pending'
              ? 'No Pending Appointment Requests'
              : activeSubTab === 'today'
              ? 'No Appointments Scheduled Today'
              : activeSubTab === 'upcoming'
              ? 'No Upcoming Appointments'
              : 'No Appointment Records Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
            {activeSubTab === 'pending'
              ? 'You have reviewed all incoming student consultation requests. Make sure your availability settings are up to date.'
              : 'No appointments match the selected filter criteria. Students can book consultation slots during your configured active hours.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAvailability}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Sliders className="w-4 h-4 mr-1.5" />
            Check Availability Settings
          </Button>
        </div>
      ) : (
        /* APPOINTMENT CARDS */
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {appointments.map((app) => {
              const studentName = app.student?.user?.name || 'Enrolled Student';
              const studentRoll = app.student?.rollNumber || '';
              const studentDept = app.student?.department?.code || '';
              const isPending = app.status === 'pending';
              const isApproved = app.status === 'approved' || app.status === 'rescheduled';
              const isOnline = app.meetingMode === 'online';

              return (
                <div
                  key={app._id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top: Student & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {studentName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{studentName}</h4>
                          <p className="text-[11px] text-slate-500">
                            {studentRoll}{studentDept ? ` • ${studentDept}` : ''}
                          </p>
                        </div>
                      </div>
                      <div>{getStatusBadge(app.status)}</div>
                    </div>

                    {/* Title & Type */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="indigo" size="xs">
                          {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                        </Badge>
                        {app.subject && (
                          <span className="text-[10px] text-purple-700 font-medium">
                            {app.subject.code || app.subject.name}
                          </span>
                        )}
                      </div>
                      <h5 className="text-xs font-bold text-slate-800 mt-1">{app.title}</h5>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{app.description}</p>
                    </div>

                    {/* Date / Time / Mode */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-purple-600" />
                        <span>{formatDate(app.date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        <span>{app.startTime} - {app.endTime} ({app.durationMinutes || 30}m)</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        {isOnline ? (
                          <span className="flex items-center gap-1 text-blue-700">
                            <Video className="w-3.5 h-3.5" />
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{app.location || 'Faculty Cabin'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Reschedule Note if applicable */}
                    {app.rescheduledFrom?.date && (
                      <p className="text-[11px] text-indigo-700 bg-indigo-50/60 p-2 rounded-lg">
                        <strong>Rescheduled from:</strong> {app.rescheduledFrom.date} ({app.rescheduledFrom.startTime} - {app.rescheduledFrom.endTime})
                      </p>
                    )}

                    {/* Rejection / Cancellation Reason */}
                    {app.rejectionReason && (
                      <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg">
                        <strong>Rejection Reason:</strong> {app.rejectionReason}
                      </p>
                    )}
                    {app.cancellationReason && (
                      <p className="text-[11px] text-slate-600 bg-slate-100 p-2 rounded-lg">
                        <strong>Cancellation Reason:</strong> {app.cancellationReason}
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleOpenDetails(app)}
                      className="text-slate-600 hover:text-purple-700"
                    >
                      <Info className="w-3.5 h-3.5 mr-1" />
                      Details & History
                    </Button>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {isPending && (
                        <>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleOpenReject(app)}
                            className="text-rose-600 hover:bg-rose-50 border-rose-200"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleOpenReschedule(app)}
                            className="text-indigo-600 hover:bg-indigo-50 border-indigo-200"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reschedule
                          </Button>
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleOpenApprove(app)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                        </>
                      )}

                      {isApproved && (
                        <>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleOpenNotes(app)}
                            className="text-purple-700 hover:bg-purple-50 border-purple-200"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Meeting Notes
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleOpenReschedule(app)}
                            className="text-indigo-600 hover:bg-indigo-50"
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleMarkComplete(app, false)}
                            className="text-teal-700 hover:bg-teal-50 border-teal-200"
                          >
                            Complete
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleOpenCancel(app)}
                            className="text-slate-500 hover:text-rose-600"
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {app.status === 'completed' && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => handleOpenNotes(app)}
                          className="text-purple-700 hover:bg-purple-50 border-purple-200"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          View/Edit Notes
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} appointments
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </Button>
                <span className="text-xs font-semibold px-2 text-slate-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: AVAILABILITY MANAGER */}
      <Modal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        title="Faculty Consultation Availability"
        subtitle="Configure weekly consultation slots, breaks, notice period, and unavailable dates"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAvailabilityModalOpen(false)}
              disabled={isSavingAvailability}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAvailability}
              isLoading={isSavingAvailability}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Save Availability
            </Button>
          </>
        }
      >
        {isLoadingAvailability || !availabilityConfig ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <RefreshCw className="w-7 h-7 text-purple-600 animate-spin mb-2" />
            <p className="text-xs text-slate-500">Loading availability settings...</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
            {/* General Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Slot Duration</label>
                <select
                  value={availabilityConfig.appointmentDuration || 30}
                  onChange={(e) => setAvailabilityConfig({ ...availabilityConfig, appointmentDuration: Number(e.target.value) })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Max Bookings / Day</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={availabilityConfig.maximumAppointmentsPerDay || 8}
                  onChange={(e) => setAvailabilityConfig({ ...availabilityConfig, maximumAppointmentsPerDay: Number(e.target.value) })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notice Required</label>
                <select
                  value={availabilityConfig.minimumNoticeHours || 2}
                  onChange={(e) => setAvailabilityConfig({ ...availabilityConfig, minimumNoticeHours: Number(e.target.value) })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value={1}>1 Hour</option>
                  <option value={2}>2 Hours</option>
                  <option value={6}>6 Hours</option>
                  <option value={24}>24 Hours</option>
                </select>
              </div>
            </div>

            {/* Default Location & Meeting Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Default Meeting Location</label>
                <input
                  type="text"
                  value={availabilityConfig.defaultLocation || ''}
                  onChange={(e) => setAvailabilityConfig({ ...availabilityConfig, defaultLocation: e.target.value })}
                  placeholder="e.g. Faculty Cabin, Block B Room 304"
                  className="w-full text-xs p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Default Online Meeting URL</label>
                <input
                  type="url"
                  value={availabilityConfig.defaultMeetingUrl || ''}
                  onChange={(e) => setAvailabilityConfig({ ...availabilityConfig, defaultMeetingUrl: e.target.value })}
                  placeholder="https://meet.google.com/..."
                  className="w-full text-xs p-2 rounded-xl border border-slate-200"
                />
              </div>
            </div>

            {/* Weekly Consultation Windows */}
            <div>
              <h4 className="font-bold text-slate-800 mb-2">Weekly Consultation Windows</h4>
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const dayItem = availabilityConfig.weeklyAvailability?.find(d => d.dayOfWeek === day) || {
                    dayOfWeek: day,
                    isActive: false,
                    slots: [{ startTime: '10:00', endTime: '12:00' }]
                  };

                  const toggleDay = () => {
                    const updated = (availabilityConfig.weeklyAvailability || []).map(d =>
                      d.dayOfWeek === day ? { ...d, isActive: !d.isActive } : d
                    );
                    if (!updated.some(d => d.dayOfWeek === day)) {
                      updated.push({ dayOfWeek: day, isActive: true, slots: [{ startTime: '10:00', endTime: '12:00' }] });
                    }
                    setAvailabilityConfig({ ...availabilityConfig, weeklyAvailability: updated });
                  };

                  return (
                    <div key={day} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dayItem.isActive}
                          onChange={toggleDay}
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                        />
                        <span className={`font-semibold ${dayItem.isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                          {day}
                        </span>
                      </div>

                      {dayItem.isActive ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Available:</span>
                          <span className="font-mono font-semibold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">
                            {dayItem.slots?.[0]?.startTime || '10:00'} - {dayItem.slots?.[0]?.endTime || '16:00'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: APPROVE APPOINTMENT */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve Appointment Request"
        subtitle={`Confirm consultation with ${activeAppointment?.student?.user?.name || 'Student'}`}
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApproveSubmit}
              isLoading={isSubmittingAction}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Confirm Approval
            </Button>
          </>
        }
      >
        <form onSubmit={handleApproveSubmit} className="space-y-3.5 text-xs">
          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
            <p className="font-bold text-emerald-900">{activeAppointment?.title}</p>
            <p className="text-emerald-700">
              {formatDate(activeAppointment?.date)} • {activeAppointment?.startTime} - {activeAppointment?.endTime}
            </p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Meeting Location</label>
            <input
              type="text"
              value={approveForm.location}
              onChange={(e) => setApproveForm({ ...approveForm, location: e.target.value })}
              placeholder="e.g. Faculty Room 204 or Department Library"
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
            />
          </div>

          {activeAppointment?.meetingMode === 'online' && (
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Online Meeting URL</label>
              <input
                type="url"
                value={approveForm.meetingUrl}
                onChange={(e) => setApproveForm({ ...approveForm, meetingUrl: e.target.value })}
                placeholder="https://meet.google.com/..."
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
              />
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Approval Note (Optional)</label>
            <textarea
              rows={2}
              value={approveForm.note}
              onChange={(e) => setApproveForm({ ...approveForm, note: e.target.value })}
              placeholder="e.g. Please bring your draft project report along..."
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 3: REJECT APPOINTMENT */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Appointment Request"
        subtitle="Provide a reason for student feedback"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRejectSubmit}
              isLoading={isSubmittingAction}
            >
              Reject Request
            </Button>
          </>
        }
      >
        <form onSubmit={handleRejectSubmit} className="space-y-3.5 text-xs">
          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Reason for Rejection</label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Scheduled department academic council meeting during this hour. Please book an afternoon slot."
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
              required
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 4: RESCHEDULE APPOINTMENT */}
      <Modal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        title="Reschedule Appointment"
        subtitle="Propose a new consultation date and time slot"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRescheduleModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRescheduleSubmit}
              isLoading={isSubmittingAction}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Reschedule
            </Button>
          </>
        }
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-3.5 text-xs">
          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 block mb-1">New Date</label>
            <input
              type="date"
              value={rescheduleForm.newDate}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, newDate: e.target.value })}
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">New Start Time</label>
              <input
                type="time"
                value={rescheduleForm.newStartTime}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, newStartTime: e.target.value })}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">New End Time</label>
              <input
                type="time"
                value={rescheduleForm.newEndTime}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, newEndTime: e.target.value })}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Reschedule Reason</label>
            <textarea
              rows={2}
              value={rescheduleForm.reason}
              onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
              placeholder="e.g. Shifted due to lab examination supervision duty."
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 5: PRIVATE MEETING NOTES */}
      <Modal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        title="Private Academic Meeting Notes"
        subtitle="Confidential records for faculty review (protected from student view)"
        maxWidth="max-w-lg"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsNotesModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNotesSubmit}
              isLoading={isSubmittingAction}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Save Private Notes
            </Button>
          </>
        }
      >
        <form onSubmit={handleNotesSubmit} className="space-y-3.5 text-xs">
          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Confidential Summary & Assessment <span className="text-purple-600">(Faculty Only)</span>
            </label>
            <textarea
              rows={3}
              value={notesForm.privateSummary}
              onChange={(e) => setNotesForm({ ...notesForm, privateSummary: e.target.value })}
              placeholder="Document student's comprehension level, specific doubts clarified, or academic progress notes..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Discussion Topics (Comma-separated)</label>
            <input
              type="text"
              value={notesForm.discussionTopics}
              onChange={(e) => setNotesForm({ ...notesForm, discussionTopics: e.target.value })}
              placeholder="e.g. Graph Algorithms, Project Architecture, Exam Prep"
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Action Items (Comma-separated)</label>
            <input
              type="text"
              value={notesForm.actionItems}
              onChange={(e) => setNotesForm({ ...notesForm, actionItems: e.target.value })}
              placeholder="e.g. Submit revised abstract, Practice DFS questions"
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
            />
          </div>

          <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 flex items-center justify-between">
            <div>
              <span className="font-bold text-purple-900 block">Follow-up Required?</span>
              <span className="text-[11px] text-purple-700">Flag this student for subsequent consultation</span>
            </div>
            <input
              type="checkbox"
              checked={notesForm.followUpRequired}
              onChange={(e) => setNotesForm({ ...notesForm, followUpRequired: e.target.checked })}
              className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
            />
          </div>

          {notesForm.followUpRequired && (
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Target Follow-up Date</label>
              <input
                type="date"
                value={notesForm.followUpDate}
                onChange={(e) => setNotesForm({ ...notesForm, followUpDate: e.target.value })}
                className="w-full text-xs p-2 rounded-xl border border-slate-200"
              />
            </div>
          )}
        </form>
      </Modal>

      {/* MODAL 6: CANCEL CONFIRMATION */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Appointment"
        subtitle="This will update the appointment status to Cancelled"
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Keep Appointment
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelSubmit}
              isLoading={isSubmittingAction}
            >
              Cancel Appointment
            </Button>
          </>
        }
      >
        <form onSubmit={handleCancelSubmit} className="space-y-3.5 text-xs">
          {actionError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Cancellation Reason</label>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Unforeseen academic committee commitment."
              className="w-full text-xs p-2 rounded-xl border border-slate-200"
              required
            />
          </div>
        </form>
      </Modal>

      {/* MODAL 7: APPOINTMENT DETAILS & HISTORY */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={activeAppointment?.title || 'Appointment Details'}
        subtitle={`Session with ${activeAppointment?.student?.user?.name || 'Student'}`}
        maxWidth="max-w-lg"
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsDetailsModalOpen(false)}
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400 block">Student</span>
              <span className="font-bold text-slate-800">{activeAppointment?.student?.user?.name || 'Student'}</span>
              <p className="text-[11px] text-slate-500">{activeAppointment?.student?.rollNumber}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Status</span>
              <div>{getStatusBadge(activeAppointment?.status)}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Date & Time</span>
              <span className="font-semibold text-slate-700">
                {formatDate(activeAppointment?.date)} • {activeAppointment?.startTime} - {activeAppointment?.endTime}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Meeting Mode</span>
              <span className="font-semibold text-slate-700">
                {activeAppointment?.meetingMode === 'online' ? 'Online Video' : (activeAppointment?.location || 'In Person')}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">Description & Objective</span>
            <p className="p-2.5 rounded-lg bg-slate-50 text-slate-700 leading-relaxed">
              {activeAppointment?.description}
            </p>
          </div>

          {/* Audit History Log */}
          {Array.isArray(activeAppointment?.history) && activeAppointment.history.length > 0 && (
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold mb-1">Status Transitions & Audit Trail</span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {activeAppointment.history.map((h, i) => (
                  <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-start justify-between text-[11px]">
                    <div>
                      <span className="font-bold text-purple-800">{h.newStatus}</span>
                      {h.reason && <p className="text-slate-600 mt-0.5">{h.reason}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Private Notes Display for Faculty */}
          {activeAppointment?.meetingNotes?.privateSummary && (
            <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200">
              <span className="text-[10px] font-bold text-purple-900 block mb-1">Private Meeting Notes</span>
              <p className="text-purple-800">{activeAppointment.meetingNotes.privateSummary}</p>
              {activeAppointment.meetingNotes.followUpRequired && (
                <p className="text-[10px] font-semibold text-purple-700 mt-1">
                  Target Follow-up: {activeAppointment.meetingNotes.followUpDate || 'Pending'}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StudentAppointmentSection;
