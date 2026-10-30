import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Filter,
  Search,
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  MapPin,
  CalendarDays,
  FileText,
  Award,
  Users,
  Building,
  Check,
  Trash2,
  Edit2,
  ExternalLink,
  RefreshCw,
  X,
  Sparkles,
  BookOpen
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import api from '../../../api/apiClient';

const CALENDAR_CATEGORIES = [
  'All',
  'Academic Events',
  'Examinations',
  'Assignment Deadlines',
  'Faculty Meetings',
  'Department Meeting',
  'Student Appointments',
  'Holidays',
  'Personal Events',
  'Other'
];

const CATEGORY_STYLES = {
  'Academic Events': {
    bg: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900',
    badge: 'primary',
    dot: 'bg-indigo-500'
  },
  'Examinations': {
    bg: 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900',
    badge: 'rose',
    dot: 'bg-rose-500'
  },
  'Assignment Deadlines': {
    bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900',
    badge: 'amber',
    dot: 'bg-amber-500'
  },
  'Faculty Meetings': {
    bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900',
    badge: 'purple',
    dot: 'bg-purple-500'
  },
  'Department Meeting': {
    bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900',
    badge: 'purple',
    dot: 'bg-purple-500'
  },
  'Student Appointments': {
    bg: 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-900',
    badge: 'teal',
    dot: 'bg-teal-500'
  },
  'Holidays': {
    bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900',
    badge: 'emerald',
    dot: 'bg-emerald-500'
  },
  'Personal Events': {
    bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-900',
    badge: 'blue',
    dot: 'bg-blue-500'
  },
  'Other': {
    bg: 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800',
    badge: 'secondary',
    dot: 'bg-slate-500'
  }
};

const DEFAULT_STYLE = {
  bg: 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800',
  badge: 'secondary',
  dot: 'bg-slate-400'
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AcademicCalendarSection = ({ onAddToast, onNavigateTab }) => {
  // Navigation & View States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month'); // 'month', 'week', 'agenda', 'upcoming'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);

  // Form State
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    category: 'Personal Events',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    allDay: false,
    location: '',
    priority: 'normal',
    reminders: [{ intervalMinutes: 30, label: '30 minutes before' }]
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notifications State
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all', 'unread'
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Fetch Calendar Events
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Build date window covering previous, current, and next month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month + 2, 0, 23, 59, 59).toISOString();

      const res = await api.getFacultyCalendarEvents({
        startDate,
        endDate,
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        search: searchQuery || undefined
      });

      if (res && res.data) {
        setEvents(res.data.events || []);
      } else {
        setEvents([]);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load academic calendar events');
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, selectedCategory, searchQuery]);

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const res = await api.getFacultyNotifications({ limit: 50 });
      if (res && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      // Quiet fail
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000); // 1 minute background sync
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Date Navigation Helpers
  const handlePrev = () => {
    if (calendarView === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (calendarView === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (calendarView === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (calendarView === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open Create Modal
  const handleOpenCreateModal = (datePrefill = null) => {
    const defaultDate = datePrefill || currentDate.toISOString().slice(0, 10);
    setEventFormData({
      title: '',
      description: '',
      category: 'Personal Events',
      startDate: defaultDate,
      startTime: '10:00',
      endDate: defaultDate,
      endTime: '11:00',
      allDay: false,
      location: '',
      priority: 'normal',
      reminders: [{ intervalMinutes: 30, label: '30 minutes before' }]
    });
    setFormErrors({});
    setIsEditingEvent(false);
    setEditingEventId(null);
    setIsEventModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (event) => {
    if (!event.isPersonalEvent) return;

    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    const pad = (n) => String(n).padStart(2, '0');
    const startDateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const startTimeStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    const endDateStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    const endTimeStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

    setEventFormData({
      title: event.title || '',
      description: event.description || '',
      category: event.category || 'Personal Events',
      startDate: startDateStr,
      startTime: startTimeStr,
      endDate: endDateStr,
      endTime: endTimeStr,
      allDay: Boolean(event.allDay),
      location: event.location || '',
      priority: event.priority || 'normal',
      status: event.status || 'scheduled',
      reminders: event.reminders && event.reminders.length > 0
        ? event.reminders
        : [{ intervalMinutes: 30, label: '30 minutes before' }]
    });
    setFormErrors({});
    setIsEditingEvent(true);
    setEditingEventId(event.id || event._id);
    setIsEventModalOpen(true);
    setIsDetailsOpen(false);
  };

  // Save Personal Event (Create or Edit)
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!eventFormData.title.trim()) {
      errors.title = 'Event title is required';
    }
    if (!eventFormData.startDate) {
      errors.startDate = 'Start date is required';
    }
    if (!eventFormData.endDate) {
      errors.endDate = 'End date is required';
    }

    const startIso = eventFormData.allDay
      ? `${eventFormData.startDate}T00:00:00.000Z`
      : `${eventFormData.startDate}T${eventFormData.startTime || '00:00'}:00.000Z`;

    const endIso = eventFormData.allDay
      ? `${eventFormData.endDate}T23:59:59.999Z`
      : `${eventFormData.endDate}T${eventFormData.endTime || '23:59'}:00.000Z`;

    if (new Date(endIso) < new Date(startIso)) {
      errors.endDate = 'End date/time must be after start date/time';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: eventFormData.title.trim(),
        description: eventFormData.description.trim(),
        category: eventFormData.category,
        startDate: startIso,
        endDate: endIso,
        allDay: eventFormData.allDay,
        location: eventFormData.location.trim(),
        priority: eventFormData.priority,
        reminders: eventFormData.reminders
      };

      if (isEditingEvent) {
        if (eventFormData.status) {
          payload.status = eventFormData.status;
        }
        await api.updateFacultyPersonalEvent(editingEventId, payload);
        onAddToast?.('Event updated successfully', 'success');
      } else {
        await api.createFacultyPersonalEvent(payload);
        onAddToast?.('Personal event created successfully', 'success');
      }

      setIsEventModalOpen(false);
      fetchEvents();
      fetchNotifications();
    } catch (err) {
      onAddToast?.(err?.message || 'Failed to save event', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Personal Event
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.deleteFacultyPersonalEvent(eventId);
      onAddToast?.('Event deleted successfully', 'success');
      setIsDetailsOpen(false);
      fetchEvents();
      fetchNotifications();
    } catch (err) {
      onAddToast?.(err?.message || 'Failed to delete event', 'error');
    }
  };

  // Mark Personal Event Complete
  const handleToggleComplete = async (event) => {
    if (!event.isPersonalEvent) return;
    try {
      const newStatus = event.status === 'completed' ? 'scheduled' : 'completed';
      await api.updateFacultyPersonalEvent(event.id || event._id, { status: newStatus });
      onAddToast?.(`Event marked as ${newStatus}`, 'success');
      setSelectedEvent((prev) => (prev ? { ...prev, status: newStatus } : null));
      fetchEvents();
    } catch (err) {
      onAddToast?.(err?.message || 'Failed to update event status', 'error');
    }
  };

  // Notification Actions
  const handleMarkNotificationRead = async (notifId) => {
    try {
      await api.markFacultyNotificationAsRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      onAddToast?.('Failed to mark notification as read', 'error');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllFacultyNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      onAddToast?.('All notifications marked as read', 'success');
    } catch (err) {
      onAddToast?.('Failed to mark all as read', 'error');
    }
  };

  // Month Grid Calculation
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay(); // 0 is Sun
    const totalDays = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const dateObj = new Date(year, month - 1, d);
      days.push({
        date: dateObj,
        dayNumber: d,
        isCurrentMonth: false,
        dateString: dateObj.toISOString().slice(0, 10)
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month, d);
      days.push({
        date: dateObj,
        dayNumber: d,
        isCurrentMonth: true,
        dateString: dateObj.toISOString().slice(0, 10)
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const dateObj = new Date(year, month + 1, d);
      days.push({
        date: dateObj,
        dayNumber: d,
        isCurrentMonth: false,
        dateString: dateObj.toISOString().slice(0, 10)
      });
    }

    return days;
  }, [currentDate]);

  // Week Grid Calculation (Monday - Sunday)
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    // Calculate Monday of current week
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        dayName: DAYS_SHORT[d.getDay()],
        dateString: d.toISOString().slice(0, 10)
      });
    }
    return days;
  }, [currentDate]);

  // Events filtered by active category and search
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedCategory !== 'All' && ev.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = ev.title?.toLowerCase().includes(q);
        const inDesc = ev.description?.toLowerCase().includes(q);
        const inLoc = ev.location?.toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inLoc) return false;
      }
      return true;
    });
  }, [events, selectedCategory, searchQuery]);

  // Map events by date string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = {};
    filteredEvents.forEach((ev) => {
      const startStr = new Date(ev.startDate).toISOString().slice(0, 10);
      const endStr = new Date(ev.endDate).toISOString().slice(0, 10);

      // Add to start date
      if (!map[startStr]) map[startStr] = [];
      map[startStr].push(ev);

      // If multi-day, add to end date as well if different
      if (startStr !== endStr) {
        if (!map[endStr]) map[endStr] = [];
        if (!map[endStr].some((x) => x.id === ev.id)) {
          map[endStr].push(ev);
        }
      }
    });
    return map;
  }, [filteredEvents]);

  // Upcoming vs Past Events
  const { upcomingEvents, previousEvents } = useMemo(() => {
    const now = new Date();
    const upcoming = [];
    const previous = [];

    filteredEvents.forEach((ev) => {
      const end = new Date(ev.endDate || ev.startDate);
      if (end >= now) {
        upcoming.push(ev);
      } else {
        previous.push(ev);
      }
    });

    upcoming.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    previous.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    return { upcomingEvents: upcoming, previousEvents: previous };
  }, [filteredEvents]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER & CONTROL BAR */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <CalendarIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Academic Calendar & Reminders</h1>
                <Badge variant="purple" size="xs">Phase 6</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Institutional timetable, examinations, assignments, student consultations, and personal events
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTIONS */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Notification Center Trigger */}
          <button
            type="button"
            onClick={() => setIsNotificationOpen(true)}
            className="relative px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-2 transition-colors cursor-pointer"
            title="Open Notification Center"
          >
            <Bell className="w-4 h-4 text-purple-600" />
            <span>Alerts & Reminders</span>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchEvents}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Calendar"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-600' : ''}`} />
          </button>

          {/* Create Event Button */}
          <Button
            variant="purple"
            size="sm"
            onClick={() => handleOpenCreateModal()}
            icon={Plus}
          >
            Add Personal Event
          </Button>
        </div>
      </div>

      {/* FILTER BAR & VIEW TOGGLES */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Date Navigator */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-900 ml-2">
            {calendarView === 'month' &&
              currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            {calendarView === 'week' &&
              `Week of ${weekDays[0]?.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekDays[6]?.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
            {(calendarView === 'agenda' || calendarView === 'upcoming') &&
              currentDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* View Switcher & Search */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Search Box */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Filter Dropdown */}
          <div className="flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              {CALENDAR_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle Tabs */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            {['month', 'week', 'agenda', 'upcoming'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCalendarView(v)}
                className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                  calendarView === v
                    ? 'bg-white text-purple-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="xs" onClick={fetchEvents}>
            Retry
          </Button>
        </div>
      )}

      {/* MAIN CALENDAR DISPLAY */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 shadow-subtle text-center">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">Loading academic events & personal schedules...</p>
        </div>
      ) : (
        <>
          {/* MONTH VIEW */}
          {calendarView === 'month' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                {DAYS_SHORT.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-[560px]">
                {monthData.map((dayObj, idx) => {
                  const dayEvents = eventsByDate[dayObj.dateString] || [];
                  const isToday = dayObj.dateString === todayStr;

                  return (
                    <div
                      key={idx}
                      className={`min-h-[110px] p-2 flex flex-col transition-colors group ${
                        dayObj.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-400'
                      } hover:bg-purple-50/20`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday
                              ? 'bg-purple-600 text-white shadow-xs'
                              : dayObj.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {dayObj.dayNumber}
                        </span>

                        {dayObj.isCurrentMonth && (
                          <button
                            type="button"
                            onClick={() => handleOpenCreateModal(dayObj.dateString)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
                            title={`Add event on ${dayObj.dateString}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Event Badges */}
                      <div className="space-y-1 flex-1 overflow-y-auto max-h-[85px]">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const style = CATEGORY_STYLES[ev.category] || DEFAULT_STYLE;
                          return (
                            <button
                              key={ev.id || ev._id}
                              type="button"
                              onClick={() => {
                                setSelectedEvent(ev);
                                setIsDetailsOpen(true);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium border truncate transition-all flex items-center space-x-1 cursor-pointer ${style.bg}`}
                              title={`${ev.title} (${ev.category})`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                              <span className="truncate">{ev.title}</span>
                            </button>
                          );
                        })}

                        {dayEvents.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentDate(dayObj.date);
                              setCalendarView('agenda');
                            }}
                            className="text-[10px] text-purple-700 hover:underline font-semibold block px-1"
                          >
                            +{dayEvents.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {calendarView === 'week' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
              <div className="grid grid-cols-7 divide-x divide-slate-100">
                {weekDays.map((wDay) => {
                  const dayEvents = eventsByDate[wDay.dateString] || [];
                  const isToday = wDay.dateString === todayStr;

                  return (
                    <div key={wDay.dateString} className="min-h-[480px] flex flex-col">
                      {/* Day Header */}
                      <div
                        className={`p-3 text-center border-b border-slate-100 ${
                          isToday ? 'bg-purple-50/70' : 'bg-slate-50/70'
                        }`}
                      >
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          {wDay.dayName}
                        </span>
                        <span
                          className={`inline-block text-sm font-bold mt-1 px-2 py-0.5 rounded-full ${
                            isToday ? 'bg-purple-600 text-white' : 'text-slate-900'
                          }`}
                        >
                          {wDay.dayNumber}
                        </span>
                      </div>

                      {/* Events list for this day */}
                      <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                        {dayEvents.length === 0 ? (
                          <p className="text-[11px] text-slate-300 text-center py-6">No events</p>
                        ) : (
                          dayEvents.map((ev) => {
                            const style = CATEGORY_STYLES[ev.category] || DEFAULT_STYLE;
                            return (
                              <div
                                key={ev.id || ev._id}
                                onClick={() => {
                                  setSelectedEvent(ev);
                                  setIsDetailsOpen(true);
                                }}
                                className={`p-2 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-xs ${style.bg}`}
                              >
                                <span className="font-bold block truncate">{ev.title}</span>
                                <div className="flex items-center space-x-1 text-[10px] opacity-80 mt-1">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span>
                                    {new Date(ev.startDate).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                {ev.location && (
                                  <div className="flex items-center space-x-1 text-[10px] opacity-80 mt-0.5 truncate">
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{ev.location}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AGENDA VIEW */}
          {calendarView === 'agenda' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Schedule */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <CalendarDays className="w-4 h-4 text-purple-600" />
                    <span>Schedule for {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                  </h3>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => handleOpenCreateModal(currentDate.toISOString().slice(0, 10))}
                    icon={Plus}
                  >
                    Add Event Today
                  </Button>
                </div>

                {(() => {
                  const todayEvents = eventsByDate[currentDate.toISOString().slice(0, 10)] || [];
                  if (todayEvents.length === 0) {
                    return (
                      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-subtle text-center text-slate-400">
                        <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-600">No scheduled events for this date</p>
                        <p className="text-[11px] text-slate-400 mt-1">Enjoy your open schedule or schedule a session above.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {todayEvents.map((ev) => {
                        const style = CATEGORY_STYLES[ev.category] || DEFAULT_STYLE;
                        return (
                          <div
                            key={ev.id || ev._id}
                            onClick={() => {
                              setSelectedEvent(ev);
                              setIsDetailsOpen(true);
                            }}
                            className={`p-4 rounded-xl border bg-white hover:bg-slate-50/70 border-slate-200 transition-all flex items-start justify-between gap-4 cursor-pointer`}
                          >
                            <div className="flex items-start space-x-3 min-w-0">
                              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">{ev.title}</h4>
                                  <Badge variant={style.badge} size="xs">{ev.category}</Badge>
                                </div>
                                {ev.description && (
                                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{ev.description}</p>
                                )}
                                <div className="flex items-center space-x-4 text-[11px] text-slate-500 mt-2">
                                  <span className="flex items-center space-x-1">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    <span>
                                      {new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                                      {new Date(ev.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </span>
                                  {ev.location && (
                                    <span className="flex items-center space-x-1 truncate">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="truncate">{ev.location}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                {ev.sourceType || 'Event'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Mini Upcoming Sidebar */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-subtle space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Upcoming Highlights ({upcomingEvents.length})
                </h3>
                <div className="space-y-2.5 max-h-[450px] overflow-y-auto">
                  {upcomingEvents.slice(0, 6).map((ev) => {
                    const style = CATEGORY_STYLES[ev.category] || DEFAULT_STYLE;
                    return (
                      <div
                        key={ev.id || ev._id}
                        onClick={() => {
                          setSelectedEvent(ev);
                          setIsDetailsOpen(true);
                        }}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-purple-50/30 transition-colors cursor-pointer text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 truncate pr-2">{ev.title}</span>
                          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>{new Date(ev.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          <span className="font-mono">
                            {new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {upcomingEvents.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No upcoming events found</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* UPCOMING & PREVIOUS LIST VIEW */}
          {calendarView === 'upcoming' && (
            <div className="space-y-6">
              {/* Upcoming Events */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <CalendarIcon className="w-4 h-4 text-purple-600" />
                    <span>Upcoming Events ({upcomingEvents.length})</span>
                  </h3>
                  <Badge variant="purple" size="xs">Chronological</Badge>
                </div>

                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No upcoming events found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {upcomingEvents.map((ev) => {
                      const style = CATEGORY_STYLES[ev.category] || DEFAULT_STYLE;
                      return (
                        <div
                          key={ev.id || ev._id}
                          onClick={() => {
                            setSelectedEvent(ev);
                            setIsDetailsOpen(true);
                          }}
                          className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/20 transition-all flex items-start justify-between gap-3 text-xs cursor-pointer bg-white"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 truncate">{ev.title}</span>
                              <Badge variant={style.badge} size="xs">{ev.category}</Badge>
                            </div>
                            {ev.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1">{ev.description}</p>
                            )}
                            <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1">
                              <span className="flex items-center space-x-1">
                                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                <span>{new Date(ev.startDate).toLocaleDateString()}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>
                                  {new Date(ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </span>
                            </div>
                          </div>
                          <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${style.dot}`} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Past / Previous Events */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-600 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Previous Events ({previousEvents.length})</span>
                  </h3>
                  <Badge variant="secondary" size="xs">Archived</Badge>
                </div>

                {previousEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No previous events found.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-80">
                    {previousEvents.slice(0, 10).map((ev) => (
                      <div
                        key={ev.id || ev._id}
                        onClick={() => {
                          setSelectedEvent(ev);
                          setIsDetailsOpen(true);
                        }}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 text-xs cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-700 block truncate">{ev.title}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {new Date(ev.startDate).toLocaleDateString()} &bull; {ev.category}
                          </span>
                        </div>
                        <Badge variant="secondary" size="xs">Concluded</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* EVENT DETAILS MODAL */}
      <Modal
        isOpen={isDetailsOpen && !!selectedEvent}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedEvent?.title || 'Event Details'}
        subtitle={selectedEvent?.category}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {selectedEvent?.isPersonalEvent && (
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(selectedEvent.id || selectedEvent._id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="secondary" size="sm" onClick={() => setIsDetailsOpen(false)}>
                Close
              </Button>
              {selectedEvent?.isPersonalEvent ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleToggleComplete(selectedEvent)}
                    icon={Check}
                  >
                    {selectedEvent.status === 'completed' ? 'Mark Scheduled' : 'Mark Complete'}
                  </Button>
                  <Button
                    variant="purple"
                    size="sm"
                    onClick={() => handleOpenEditModal(selectedEvent)}
                    icon={Edit2}
                  >
                    Edit
                  </Button>
                </>
              ) : (
                selectedEvent?.sourceType && (
                  <Button
                    variant="teal"
                    size="sm"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      if (selectedEvent.sourceType === 'assignment') onNavigateTab?.('assignments');
                      if (selectedEvent.sourceType === 'examination') onNavigateTab?.('exams');
                      if (selectedEvent.sourceType === 'appointment') onNavigateTab?.('appointments');
                      if (selectedEvent.sourceType === 'timetable') onNavigateTab?.('timetable');
                    }}
                    icon={ExternalLink}
                  >
                    Open In Module
                  </Button>
                )
              )}
            </div>
          </div>
        }
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            {/* System / Source Notice Banner */}
            {!selectedEvent.isPersonalEvent ? (
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/60 text-blue-900 flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold block">Aggregated System Record</span>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    This entry is automatically synchronized from the {selectedEvent.sourceType || 'institutional'} module.
                    To modify or manage it, please navigate to the corresponding module console.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-purple-100 bg-purple-50/50">
                <span className="text-[11px] font-semibold text-purple-900">Faculty Personal Event</span>
                <Badge variant={selectedEvent.status === 'completed' ? 'emerald' : 'purple'} size="xs">
                  {selectedEvent.status || 'scheduled'}
                </Badge>
              </div>
            )}

            {/* Date & Time Information */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center space-x-2 text-slate-700">
                <CalendarDays className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="font-semibold">
                  {new Date(selectedEvent.startDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span>
                  {new Date(selectedEvent.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &ndash;{' '}
                  {new Date(selectedEvent.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {selectedEvent.allDay && ' (All Day)'}
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center space-x-2 text-slate-700">
                  <MapPin className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedEvent.description && (
              <div>
                <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Description</label>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.description}
                </div>
              </div>
            )}

            {/* Reminders list (for personal events) */}
            {selectedEvent.reminders && selectedEvent.reminders.length > 0 && (
              <div>
                <label className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Configured Reminders</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEvent.reminders.map((rem, rIdx) => (
                    <span
                      key={rIdx}
                      className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] flex items-center space-x-1"
                    >
                      <Bell className="w-3 h-3 text-purple-600" />
                      <span>{rem.label || `${rem.intervalMinutes} min before`}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CREATE / EDIT PERSONAL EVENT MODAL */}
      <Modal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        title={isEditingEvent ? 'Edit Personal Event' : 'Create Personal Calendar Event'}
        subtitle="Manage your personal academic schedule and set reminder notifications"
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-end space-x-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEventModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="purple"
              size="sm"
              onClick={handleSaveEvent}
              isLoading={isSubmitting}
            >
              {isEditingEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveEvent} className="space-y-3.5 text-xs">
          {/* Title */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Event Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Department Curriculum Review Session"
              value={eventFormData.title}
              onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
              className={`w-full text-xs px-3 py-2 rounded-xl border text-slate-800 focus:outline-none focus:ring-1 ${
                formErrors.title ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-200 focus:ring-purple-500'
              }`}
            />
            {formErrors.title && <p className="text-rose-600 text-[11px] mt-1">{formErrors.title}</p>}
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Category</label>
              <select
                value={eventFormData.category}
                onChange={(e) => setEventFormData({ ...eventFormData, category: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value="Faculty Meeting">Faculty Meeting</option>
                <option value="Department Meeting">Department Meeting</option>
                <option value="Project Review">Project Review</option>
                <option value="Research Work">Research Work</option>
                <option value="Preparation Session">Preparation Session</option>
                <option value="Administrative Work">Administrative Work</option>
                <option value="Personal Academic Event">Personal Academic Event</option>
                <option value="Personal Events">Personal Events</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Priority</label>
              <select
                value={eventFormData.priority}
                onChange={(e) => setEventFormData({ ...eventFormData, priority: e.target.value })}
                className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Start Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={eventFormData.startDate}
                onChange={(e) => setEventFormData({ ...eventFormData, startDate: e.target.value })}
                className={`w-full text-xs px-2.5 py-2 rounded-xl border text-slate-800 focus:outline-none focus:ring-1 ${
                  formErrors.startDate ? 'border-rose-400' : 'border-slate-200 focus:ring-purple-500'
                }`}
              />
            </div>

            {!eventFormData.allDay && (
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={eventFormData.startTime}
                  onChange={(e) => setEventFormData({ ...eventFormData, startTime: e.target.value })}
                  className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}
          </div>

          {/* End Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={eventFormData.endDate}
                onChange={(e) => setEventFormData({ ...eventFormData, endDate: e.target.value })}
                className={`w-full text-xs px-2.5 py-2 rounded-xl border text-slate-800 focus:outline-none focus:ring-1 ${
                  formErrors.endDate ? 'border-rose-400' : 'border-slate-200 focus:ring-purple-500'
                }`}
              />
              {formErrors.endDate && <p className="text-rose-600 text-[11px] mt-1">{formErrors.endDate}</p>}
            </div>

            {!eventFormData.allDay && (
              <div>
                <label className="font-semibold text-slate-700 block mb-1">End Time</label>
                <input
                  type="time"
                  value={eventFormData.endTime}
                  onChange={(e) => setEventFormData({ ...eventFormData, endTime: e.target.value })}
                  className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="allDayCheckbox"
              checked={eventFormData.allDay}
              onChange={(e) => setEventFormData({ ...eventFormData, allDay: e.target.checked })}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="allDayCheckbox" className="text-xs text-slate-700 font-medium cursor-pointer">
              All-day event
            </label>
          </div>

          {/* Location */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Location / Venue</label>
            <input
              type="text"
              placeholder="e.g. Faculty Cabin 204 or Online Meeting Link"
              value={eventFormData.location}
              onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description / Notes</label>
            <textarea
              rows={3}
              placeholder="Add agenda, preparation notes, or references..."
              value={eventFormData.description}
              onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Reminder Selection */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Reminder Alert</label>
            <select
              value={eventFormData.reminders?.[0]?.intervalMinutes || 30}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                const labels = {
                  10: '10 minutes before',
                  30: '30 minutes before',
                  60: '1 hour before',
                  1440: '1 day before'
                };
                setEventFormData({
                  ...eventFormData,
                  reminders: [{ intervalMinutes: val, label: labels[val] || `${val} min before` }]
                });
              }}
              className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="10">10 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before (24 hours)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* NOTIFICATION CENTER SLIDE-OVER DRAWER / MODAL */}
      <Modal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        title="Faculty Notification Center"
        subtitle={`In-app alerts, calendar reminders, and academic notifications (${unreadCount} unread)`}
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="secondary"
              size="xs"
              onClick={handleMarkAllNotificationsRead}
              disabled={unreadCount === 0}
            >
              Mark All as Read
            </Button>
            <Button variant="purple" size="xs" onClick={() => setIsNotificationOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          {/* Filter Bar */}
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
            <button
              type="button"
              onClick={() => setNotificationFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                notificationFilter === 'all'
                  ? 'bg-purple-100 text-purple-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setNotificationFilter('unread')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                notificationFilter === 'unread'
                  ? 'bg-purple-100 text-purple-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Unread Only ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          {isLoadingNotifications ? (
            <p className="text-slate-400 text-center py-6">Loading alerts...</p>
          ) : (() => {
            const displayList = notificationFilter === 'unread'
              ? notifications.filter((n) => !n.isRead)
              : notifications;

            if (displayList.length === 0) {
              return (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">You are all caught up!</p>
                  <p className="text-[11px] text-slate-400 mt-1">No unread notifications or due reminders.</p>
                </div>
              );
            }

            return (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {displayList.map((notif) => (
                  <div
                    key={notif._id}
                    className={`p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-3 ${
                      notif.isRead
                        ? 'bg-slate-50/60 border-slate-200 text-slate-600'
                        : 'bg-white border-purple-200 text-slate-900 shadow-xs'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold truncate">{notif.title}</span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">{notif.message}</p>
                      <span className="text-[10px] text-slate-400 block pt-1">
                        {new Date(notif.createdAt).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </span>
                    </div>

                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkNotificationRead(notif._id)}
                        className="text-purple-600 hover:text-purple-800 font-semibold text-[11px] flex-shrink-0 cursor-pointer pt-0.5"
                        title="Mark as read"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};

export default AcademicCalendarSection;
