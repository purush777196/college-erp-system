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
  Check,
  X,
  BookOpen,
  CalendarDays,
  User,
  Phone,
  Mail,
  Building2,
  Sparkles,
  Info,
  Award,
  CalendarCheck
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

const APPOINTMENT_STATUS_CONFIG = {
  pending: { label: 'Pending Review', variant: 'amber', icon: Clock },
  approved: { label: 'Approved', variant: 'emerald', icon: CheckCircle2 },
  rejected: { label: 'Rejected', variant: 'rose', icon: XCircle },
  rescheduled: { label: 'Rescheduled', variant: 'indigo', icon: RotateCcw },
  cancelled: { label: 'Cancelled', variant: 'slate', icon: XCircle },
  completed: { label: 'Completed', variant: 'teal', icon: CheckCircle2 },
  no_show: { label: 'No Show', variant: 'rose', icon: AlertTriangle }
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export const StudentAppointmentsSection = ({ onAddToast }) => {
  // Navigation Sub-tab
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'pending' | 'history'

  // Data states
  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    upcoming: 0,
    completed: 0,
    cancelledOrRejected: 0
  });
  const [associatedFaculty, setAssociatedFaculty] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Booking Form State
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [bookingForm, setBookingForm] = useState({
    facultyId: '',
    subjectId: '',
    appointmentType: 'academic_doubt',
    date: todayStr,
    slot: null,
    meetingMode: 'in_person',
    title: '',
    description: ''
  });

  const [availableSlots, setAvailableSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Cancellation Form State
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Load Main Data
  const loadAppointmentsData = useCallback(async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const [appRes, sumRes, facRes] = await Promise.all([
        api.getStudentAppointments({ limit: 100 }).catch(() => ({ data: [] })),
        api.getStudentAppointmentSummary().catch(() => ({ data: null })),
        api.getStudentAssociatedFaculty().catch(() => ({ data: [] }))
      ]);

      const appList = Array.isArray(appRes?.data) ? appRes.data : [];
      setAppointments(appList);

      if (sumRes?.data) {
        setSummary(sumRes.data);
      } else {
        // Fallback calculation from actual data
        const total = appList.length;
        const pending = appList.filter((a) => a.status === 'pending').length;
        const approved = appList.filter((a) => ['approved', 'rescheduled'].includes(a.status)).length;
        const upcoming = appList.filter((a) => ['approved', 'rescheduled'].includes(a.status) && a.date >= todayStr).length;
        const completed = appList.filter((a) => a.status === 'completed').length;
        const cancelledOrRejected = appList.filter((a) => ['cancelled', 'rejected', 'no_show'].includes(a.status)).length;
        setSummary({ total, pending, approved, upcoming, completed, cancelledOrRejected });
      }

      if (Array.isArray(facRes?.data)) {
        setAssociatedFaculty(facRes.data);
      }

      if (showToast && onAddToast) {
        onAddToast({
          type: 'success',
          title: 'Consultations Refreshed',
          message: 'Appointment records and availability synchronized.'
        });
      }
    } catch (err) {
      if (onAddToast) {
        onAddToast({
          type: 'error',
          title: 'Sync Error',
          message: err.message || 'Could not fetch appointment schedule.'
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [onAddToast, todayStr]);

  useEffect(() => {
    loadAppointmentsData();
  }, [loadAppointmentsData]);

  // Load Slots when faculty or date changes in booking modal
  useEffect(() => {
    if (!bookingForm.facultyId || !bookingForm.date) {
      setAvailableSlots([]);
      return;
    }

    let isMounted = true;
    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      setBookingError('');
      try {
        const res = await api.getStudentFacultyAvailability(bookingForm.facultyId, bookingForm.date);
        if (isMounted) {
          const slots = res?.data?.slots || [];
          setAvailableSlots(slots);
          // If previous slot is not in new slots, reset
          if (bookingForm.slot && !slots.some((s) => s.startTime === bookingForm.slot.startTime)) {
            setBookingForm((prev) => ({ ...prev, slot: null }));
          }
        }
      } catch (err) {
        if (isMounted) {
          setAvailableSlots([]);
          setBookingError(err.message || 'Could not load slots for this date.');
        }
      } finally {
        if (isMounted) setIsLoadingSlots(false);
      }
    };

    fetchSlots();
    return () => {
      isMounted = false;
    };
  }, [bookingForm.facultyId, bookingForm.date, bookingForm.slot]);

  // Open Book Modal
  const handleOpenBookModal = () => {
    const defaultFac = associatedFaculty[0]?._id || '';
    const defaultSubject = associatedFaculty[0]?.subjects?.[0]?._id || '';
    setBookingForm({
      facultyId: defaultFac,
      subjectId: defaultSubject,
      appointmentType: 'academic_doubt',
      date: todayStr,
      slot: null,
      meetingMode: 'in_person',
      title: '',
      description: ''
    });
    setBookingError('');
    setIsBookModalOpen(true);
  };

  // Submit Booking Request
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setBookingError('');

    if (!bookingForm.facultyId) {
      setBookingError('Please select a faculty member.');
      return;
    }
    if (!bookingForm.date) {
      setBookingError('Please choose a preferred consultation date.');
      return;
    }
    if (!bookingForm.slot) {
      setBookingError('Please select an available consultation time slot.');
      return;
    }
    if (!bookingForm.title.trim()) {
      setBookingError('Please provide a brief title for your consultation.');
      return;
    }
    if (!bookingForm.description.trim()) {
      setBookingError('Please provide the specific reason or topic you wish to discuss.');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      await api.createStudentAppointment({
        facultyId: bookingForm.facultyId,
        subjectId: bookingForm.subjectId || undefined,
        title: bookingForm.title.trim(),
        appointmentType: bookingForm.appointmentType,
        description: bookingForm.description.trim(),
        date: bookingForm.date,
        startTime: bookingForm.slot.startTime,
        endTime: bookingForm.slot.endTime,
        meetingMode: bookingForm.meetingMode
      });

      if (onAddToast) {
        onAddToast({
          type: 'success',
          title: 'Consultation Requested',
          message: 'Your appointment request has been submitted to the faculty for review.'
        });
      }

      setIsBookModalOpen(false);
      loadAppointmentsData();
      setActiveTab('pending');
    } catch (err) {
      setBookingError(err.message || 'Failed to request appointment. Please check availability.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (appointment) => {
    setSelectedAppointment(appointment);
    setCancellationReason('');
    setCancelError('');
    setIsCancelModalOpen(true);
  };

  // Submit Cancellation
  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;
    setIsSubmittingCancel(true);
    setCancelError('');

    try {
      await api.cancelStudentAppointment(selectedAppointment._id || selectedAppointment.id, {
        reason: cancellationReason.trim() || 'Cancelled by student'
      });

      if (onAddToast) {
        onAddToast({
          type: 'success',
          title: 'Appointment Cancelled',
          message: 'The consultation request has been cancelled.'
        });
      }

      setIsCancelModalOpen(false);
      setSelectedAppointment(null);
      loadAppointmentsData();
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel appointment.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Filtered lists
  const upcomingAppointments = useMemo(() => {
    return appointments.filter(
      (a) => ['approved', 'rescheduled'].includes(a.status) && a.date >= todayStr
    );
  }, [appointments, todayStr]);

  const pendingAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'pending');
  }, [appointments]);

  const historyAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (historyStatusFilter !== 'all' && a.status !== historyStatusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (a.title || '').toLowerCase().includes(q);
        const facMatch = (a.faculty?.user?.name || '').toLowerCase().includes(q);
        const subMatch = (a.subject?.name || '').toLowerCase().includes(q);
        const descMatch = (a.description || '').toLowerCase().includes(q);
        if (!titleMatch && !facMatch && !subMatch && !descMatch) return false;
      }
      return true;
    });
  }, [appointments, historyStatusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Hero Header matching Student Blue Theme */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-700 to-indigo-800 rounded-2xl p-6 text-white shadow-card relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-black/20 text-blue-100 text-xs font-medium mb-3 backdrop-blur-sm border border-white/10">
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Academic Mentorship & Consultations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Faculty Appointments
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-blue-100/90 font-normal leading-relaxed">
            Book 1-on-1 consultations with your course instructors for doubt clearance, exam prep, project reviews, and academic mentoring.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadAppointmentsData(true)}
            icon={RefreshCw}
            isLoading={isRefreshing}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenBookModal}
            icon={Plus}
            className="bg-white text-blue-800 hover:bg-blue-50 font-semibold shadow-md border-0"
          >
            Book Appointment
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Requests</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block font-mono">{summary.total}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Lifetime bookings</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-subtle bg-amber-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">Pending</span>
          <span className="text-xl sm:text-2xl font-bold text-amber-900 mt-1 block font-mono">{summary.pending}</span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Awaiting faculty reply</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-emerald-200/80 shadow-subtle bg-emerald-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">Approved</span>
          <span className="text-xl sm:text-2xl font-bold text-emerald-900 mt-1 block font-mono">{summary.approved}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Confirmed sessions</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-blue-200/80 shadow-subtle bg-blue-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">Upcoming</span>
          <span className="text-xl sm:text-2xl font-bold text-blue-900 mt-1 block font-mono">{summary.upcoming}</span>
          <span className="text-[10px] text-blue-600 mt-0.5 block">Future schedule</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-teal-200/80 shadow-subtle bg-teal-50/20">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 block">Completed</span>
          <span className="text-xl sm:text-2xl font-bold text-teal-900 mt-1 block font-mono">{summary.completed}</span>
          <span className="text-[10px] text-teal-600 mt-0.5 block">Attended sessions</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-subtle bg-slate-50/30">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Cancelled</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-800 mt-1 block font-mono">{summary.cancelledOrRejected}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Declined / Revoked</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-subtle overflow-x-auto">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'upcoming'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Upcoming Schedule ({upcomingAppointments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Requests ({pendingAppointments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-3.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>All Appointments & History</span>
        </button>
      </div>

      {/* TAB 1: UPCOMING APPOINTMENTS */}
      {activeTab === 'upcoming' && (
        <Card
          title="Upcoming Faculty Consultations"
          subtitle="Confirmed one-on-one sessions scheduled with faculty"
          headerAction={
            <Button size="xs" variant="teal" onClick={handleOpenBookModal} icon={Plus}>
              Book Another
            </Button>
          }
        >
          {upcomingAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800">No Upcoming Consultations Scheduled</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                You do not have any approved consultations scheduled for upcoming days. Need help with coursework or exams?
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenBookModal}
                icon={Plus}
                className="mt-4"
              >
                Schedule Consultation Now
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingAppointments.map((app) => {
                const statusCfg = APPOINTMENT_STATUS_CONFIG[app.status] || APPOINTMENT_STATUS_CONFIG.approved;
                return (
                  <div
                    key={app._id}
                    className="p-4 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/30 hover:shadow-card transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant={statusCfg.variant} size="xs">
                          {statusCfg.label}
                        </Badge>
                        <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-full">
                          {formatDate(app.date)}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{app.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                        <div className="flex items-center space-x-2">
                          <User className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {app.faculty?.user?.name || 'Assigned Faculty'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({app.faculty?.designation || 'Faculty'})
                          </span>
                        </div>

                        {app.subject && (
                          <div className="flex items-center space-x-2">
                            <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{app.subject.name} ({app.subject.code})</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-700">
                          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{app.startTime} – {app.endTime} ({app.durationMinutes || 30} mins)</span>
                        </div>

                        <div className="flex items-center space-x-2 text-xs">
                          {app.meetingMode === 'online' ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                              <span className="text-indigo-700 font-medium">Online Video Meeting</span>
                              {app.meetingUrl && (
                                <a
                                  href={app.meetingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-blue-600 underline font-semibold flex items-center ml-2"
                                >
                                  Join <ExternalLink className="w-3 h-3 ml-0.5" />
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span className="text-slate-700">
                                Location: <span className="font-semibold">{app.location || 'Faculty Cabin'}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setSelectedAppointment(app);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        View Details
                      </Button>

                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => handleOpenCancelModal(app)}
                      >
                        Cancel Consultation
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: PENDING REQUESTS */}
      {activeTab === 'pending' && (
        <Card
          title="Pending Consultation Requests"
          subtitle="Requests submitted and awaiting faculty confirmation"
        >
          {pendingAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800">No Pending Requests</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                You have no pending appointment requests waiting for review. All previous submissions have been processed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingAppointments.map((app) => (
                <div
                  key={app._id}
                  className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="amber" size="xs">
                        <Clock className="w-3 h-3 mr-1" /> Pending Faculty Approval
                      </Badge>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Requested for {formatDate(app.date)} ({app.startTime} - {app.endTime})
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mt-1">{app.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-1">{app.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                      <span>Faculty: <strong className="text-slate-800">{app.faculty?.user?.name || 'Faculty Member'}</strong></span>
                      {app.subject && <span>Subject: <strong>{app.subject.name}</strong></span>}
                      <span>Mode: <strong className="capitalize">{app.meetingMode === 'in_person' ? 'In Person' : 'Online'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setSelectedAppointment(app);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      Details
                    </Button>
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={() => handleOpenCancelModal(app)}
                    >
                      Withdraw Request
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: ALL APPOINTMENTS & HISTORY */}
      {activeTab === 'history' && (
        <Card
          title="Consultation History & Archive"
          subtitle="Complete record of all scheduled, completed, and cancelled academic appointments"
          headerAction={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search consultations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
                />
              </div>

              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
              </select>
            </div>
          }
        >
          {historyAppointments.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              No appointment records match the selected filter criteria.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyAppointments.map((app) => {
                const statusCfg = APPOINTMENT_STATUS_CONFIG[app.status] || APPOINTMENT_STATUS_CONFIG.pending;
                return (
                  <div key={app._id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant={statusCfg.variant} size="xs">
                          {statusCfg.label}
                        </Badge>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {formatDate(app.date)} &bull; {app.startTime} - {app.endTime}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">{app.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>Prof. {app.faculty?.user?.name || 'Faculty'}</span>
                        {app.subject && <span>&bull; {app.subject.name}</span>}
                        <span>&bull; {APPOINTMENT_TYPE_LABELS[app.appointmentType] || app.appointmentType}</span>
                        <span>&bull; {app.meetingMode === 'in_person' ? 'In Person' : 'Online'}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setSelectedAppointment(app);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        View Full Details
                      </Button>
                      {['pending', 'approved', 'rescheduled'].includes(app.status) && (
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => handleOpenCancelModal(app)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: BOOK FACULTY CONSULTATION APPOINTMENT            */}
      {/* ========================================================= */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title="Schedule Faculty Consultation"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmitBooking} className="space-y-4 text-xs">
          {bookingError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{bookingError}</span>
            </div>
          )}

          {/* STEP 1: SELECT ASSIGNED FACULTY */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Select Faculty Member <span className="text-rose-500">*</span>
            </label>
            {associatedFaculty.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                No faculty members currently associated with your curriculum classes.
              </p>
            ) : (
              <select
                value={bookingForm.facultyId}
                onChange={(e) => {
                  const facId = e.target.value;
                  const fac = associatedFaculty.find((f) => String(f._id) === String(facId));
                  setBookingForm((prev) => ({
                    ...prev,
                    facultyId: facId,
                    subjectId: fac?.subjects?.[0]?._id || '',
                    slot: null
                  }));
                }}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                {associatedFaculty.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} — {f.department} ({f.designation || 'Faculty'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* STEP 2: SELECT APPOINTMENT CATEGORY & SUBJECT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Consultation Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={bookingForm.appointmentType}
                onChange={(e) => setBookingForm((prev) => ({ ...prev, appointmentType: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                {Object.entries(APPOINTMENT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Relevant Subject (Optional)</label>
              <select
                value={bookingForm.subjectId}
                onChange={(e) => setBookingForm((prev) => ({ ...prev, subjectId: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">General Academic Consultation</option>
                {associatedFaculty
                  .find((f) => String(f._id) === String(bookingForm.facultyId))
                  ?.subjects?.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* STEP 3: PREFERRED DATE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Preferred Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                min={todayStr}
                value={bookingForm.date}
                onChange={(e) => setBookingForm((prev) => ({ ...prev, date: e.target.value, slot: null }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Meeting Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={bookingForm.meetingMode}
                onChange={(e) => setBookingForm((prev) => ({ ...prev, meetingMode: e.target.value }))}
                className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="in_person">In Person (Faculty Cabin)</option>
                <option value="online">Online Meeting (Video Call)</option>
              </select>
            </div>
          </div>

          {/* STEP 4: TIME SLOT SELECTION */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                Select Available Consultation Slot <span className="text-rose-500">*</span>
              </label>
              {isLoadingSlots && <span className="text-[11px] text-blue-600 animate-pulse">Calculating open slots...</span>}
            </div>

            {isLoadingSlots ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl">
                Checking faculty timetable and schedule availability...
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-xs">
                No available consultation slots on this date. The faculty may have scheduled classes, reached daily limits, or have blackout dates. Please select another date.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {availableSlots.map((s, idx) => {
                  const isSelected = bookingForm.slot?.startTime === s.startTime;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBookingForm((prev) => ({ ...prev, slot: s }))}
                      className={`p-2 rounded-lg border text-xs font-mono font-bold transition-all text-center ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                    >
                      {s.startTime} – {s.endTime}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 5: TITLE & DESCRIPTION */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Appointment Title / Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Doubts on Dynamic Programming and Memoization"
              value={bookingForm.title}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Detailed Reason / Discussion Points <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Detail specific questions or areas where guidance is required so faculty can prepare..."
              value={bookingForm.description}
              onChange={(e) => setBookingForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              required
            />
          </div>

          {/* Notice for Online Meeting */}
          {bookingForm.meetingMode === 'online' && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>For online consultations, your professor will provide the verified secure video link upon confirming the appointment.</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBookModalOpen(false)}
              disabled={isSubmittingBooking}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmittingBooking}
              disabled={!bookingForm.slot || isSubmittingBooking}
            >
              Confirm Booking Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 2: APPOINTMENT DETAILS VIEW                         */}
      {/* ========================================================= */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Consultation Details"
        maxWidth="max-w-xl"
      >
        {selectedAppointment && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant={APPOINTMENT_STATUS_CONFIG[selectedAppointment.status]?.variant || 'slate'}
                  size="sm"
                >
                  {APPOINTMENT_STATUS_CONFIG[selectedAppointment.status]?.label || selectedAppointment.status}
                </Badge>
                <span className="font-mono text-slate-500">
                  {formatDate(selectedAppointment.date)}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{selectedAppointment.title}</h3>
              <p className="text-slate-500 font-medium">
                {APPOINTMENT_TYPE_LABELS[selectedAppointment.appointmentType] || selectedAppointment.appointmentType}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-slate-100 bg-white">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Faculty Member</span>
                <span className="font-bold text-slate-800 text-xs block mt-0.5">
                  {selectedAppointment.faculty?.user?.name || 'Faculty Member'}
                </span>
                <span className="text-[11px] text-slate-500">{selectedAppointment.faculty?.designation || 'Professor'}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Time Window</span>
                <span className="font-mono font-bold text-slate-800 text-xs block mt-0.5">
                  {selectedAppointment.startTime} – {selectedAppointment.endTime}
                </span>
                <span className="text-[11px] text-slate-500">{selectedAppointment.durationMinutes || 30} minutes</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Subject</span>
                <span className="font-bold text-slate-800 text-xs block mt-0.5">
                  {selectedAppointment.subject?.name || 'General Academic'}
                </span>
                {selectedAppointment.subject?.code && (
                  <span className="text-[11px] text-slate-500">Code: {selectedAppointment.subject.code}</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Meeting Mode</span>
                <span className="font-bold text-slate-800 text-xs block mt-0.5 capitalize">
                  {selectedAppointment.meetingMode === 'in_person' ? 'In Person' : 'Online Video'}
                </span>
                {selectedAppointment.meetingMode === 'in_person' ? (
                  <span className="text-[11px] text-slate-500">{selectedAppointment.location || 'Faculty Cabin'}</span>
                ) : selectedAppointment.meetingUrl ? (
                  <a
                    href={selectedAppointment.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 underline font-semibold flex items-center"
                  >
                    Open Link <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400">Link provided upon approval</span>
                )}
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-700 block mb-1">Your Stated Reason / Discussion Topics</span>
              <p className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedAppointment.description}
              </p>
            </div>

            {/* Rejection / Cancellation Notes */}
            {selectedAppointment.status === 'rejected' && selectedAppointment.rejectionReason && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <span className="font-bold block text-xs">Faculty Feedback / Rejection Reason:</span>
                <p className="mt-1 text-xs">{selectedAppointment.rejectionReason}</p>
              </div>
            )}

            {selectedAppointment.status === 'cancelled' && selectedAppointment.cancellationReason && (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                <span className="font-bold block text-xs">Cancellation Reason:</span>
                <p className="mt-1 text-xs">{selectedAppointment.cancellationReason}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 3: CANCEL / WITHDRAW APPOINTMENT                    */}
      {/* ========================================================= */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Appointment"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          {cancelError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              {cancelError}
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              Are you sure you want to cancel this consultation? This action frees the slot and notifies the faculty member.
            </p>
          </div>

          {selectedAppointment && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="font-bold text-slate-900">{selectedAppointment.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                With Prof. {selectedAppointment.faculty?.user?.name || 'Faculty'} on {formatDate(selectedAppointment.date)} ({selectedAppointment.startTime} - {selectedAppointment.endTime})
              </p>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason for Cancellation (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Personal schedule conflict, topic already resolved in lecture..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isSubmittingCancel}
            >
              Keep Appointment
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              isLoading={isSubmittingCancel}
              disabled={isSubmittingCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StudentAppointmentsSection;
