import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  X,
  Building2,
  GraduationCap,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Users
} from 'lucide-react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const WeeklyScheduleModal = ({
  isOpen,
  onClose,
  timetableSlots = [],
  myDeptName = 'Computer Science & Engineering',
  onOpenAttendance
}) => {
  const todayName = useMemo(() => new Date().toLocaleDateString('en-US', { weekday: 'long' }), []);
  const [selectedDay, setSelectedDay] = useState('All');

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Group slots by day
  const groupedSchedule = useMemo(() => {
    const map = {};
    DAYS_OF_WEEK.forEach((day) => {
      map[day] = [];
    });

    timetableSlots.forEach((slot) => {
      const rawDay = slot.dayOfWeek;
      if (!rawDay) return;
      const matchedDay = DAYS_OF_WEEK.find((d) => d.toLowerCase() === rawDay.toLowerCase());
      if (matchedDay) {
        map[matchedDay].push(slot);
      }
    });

    // Sort periods inside each day
    DAYS_OF_WEEK.forEach((day) => {
      map[day].sort((a, b) => (Number(a.periodNumber) || 0) - (Number(b.periodNumber) || 0));
    });

    return map;
  }, [timetableSlots]);

  // Helper to determine real-time class status for today
  const getClassStatus = (slot) => {
    const isToday = slot.dayOfWeek && slot.dayOfWeek.toLowerCase() === todayName.toLowerCase();
    if (!isToday) return { status: 'Scheduled', variant: 'slate' };

    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Parse start and end time (format expected: "09:00" or "09:00 AM" or "14:00")
      const parseTimeToMinutes = (tStr) => {
        if (!tStr) return null;
        const clean = tStr.trim().toUpperCase();
        const isPM = clean.includes('PM');
        const isAM = clean.includes('AM');
        const parts = clean.replace(/[APM]/g, '').trim().split(':');
        let hours = parseInt(parts[0], 10);
        const mins = parseInt(parts[1] || '0', 10);
        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
        return hours * 60 + mins;
      };

      const startMins = parseTimeToMinutes(slot.startTime);
      const endMins = parseTimeToMinutes(slot.endTime);

      if (startMins !== null && endMins !== null) {
        if (currentMinutes >= startMins && currentMinutes <= endMins) {
          return { status: 'In Session Now', variant: 'emerald', isLive: true };
        }
        if (currentMinutes < startMins) {
          return { status: 'Upcoming Today', variant: 'purple' };
        }
        return { status: 'Completed Today', variant: 'slate' };
      }
    } catch {
      // Fallback
    }

    return { status: 'Scheduled Today', variant: 'purple' };
  };

  const daysToRender = selectedDay === 'All' ? DAYS_OF_WEEK : [selectedDay];
  const totalSlotsCount = timetableSlots.length;
  const todaySlotsCount = groupedSchedule[todayName]?.length || 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-weekly-schedule-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center sm:p-6">
        <div
          className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all w-full max-w-4xl border border-slate-200 animate-in zoom-in-95 fade-in duration-200 my-6 flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white px-6 py-5 flex-shrink-0 flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/20">
                <Clock className="w-5 h-5 text-purple-200" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 id="modal-weekly-schedule-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Weekly Teaching Schedule
                  </h2>
                  <Badge variant="purple" size="xs" className="bg-white/20 text-white border-white/20">
                    {totalSlotsCount} Weekly Lectures
                  </Badge>
                </div>
                <p className="text-xs text-purple-200 mt-0.5">
                  Monday through Sunday teaching timetable, lecture periods, and allocated classrooms
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Day Navigation Tabs */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDay('All')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedDay === 'All'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              All Days ({totalSlotsCount})
            </button>

            {DAYS_OF_WEEK.map((day) => {
              const count = groupedSchedule[day]?.length || 0;
              const isToday = day.toLowerCase() === todayName.toLowerCase();
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-700 text-white shadow-xs'
                      : isToday
                      ? 'bg-purple-100 border border-purple-300 text-purple-800 hover:bg-purple-200'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{day}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : isToday ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {isToday && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" title="Today" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">
            {totalSlotsCount === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <h4 className="text-sm font-semibold text-slate-700">No Timetable Sessions Scheduled</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  There are no lecture sessions assigned to your profile in the current institutional timetable.
                </p>
              </div>
            ) : (
              daysToRender.map((day) => {
                const slots = groupedSchedule[day] || [];
                const isToday = day.toLowerCase() === todayName.toLowerCase();

                return (
                  <div
                    key={day}
                    className={`rounded-2xl border transition-all ${
                      isToday
                        ? 'border-purple-300 ring-2 ring-purple-500/15 bg-white shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Day Group Header */}
                    <div
                      className={`px-4 sm:px-5 py-3 border-b flex items-center justify-between rounded-t-2xl ${
                        isToday
                          ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm">{day}</span>
                        {isToday && (
                          <Badge variant="purple" size="xs" className="font-bold">
                            Today
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {slots.length} {slots.length === 1 ? 'Period Scheduled' : 'Periods Scheduled'}
                      </span>
                    </div>

                    {/* Day Sessions List */}
                    <div className="p-4 sm:p-5">
                      {slots.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs">
                          No scheduled lectures for {day}.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {slots.map((slot) => {
                            const statusInfo = getClassStatus(slot);
                            const sub = slot.subject;
                            const subName = sub?.name || sub?.code || 'Scheduled Class Lecture';
                            const subCode = sub?.code || 'SUB';

                            return (
                              <div
                                key={slot._id || slot.id}
                                className={`p-3.5 sm:p-4 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                                  statusInfo.isLive
                                    ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-500/20'
                                    : isToday
                                    ? 'bg-purple-50/30 border-purple-200/80 hover:bg-purple-50/60'
                                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
                                }`}
                              >
                                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                                  {/* Period Number Avatar */}
                                  <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-mono font-bold text-xs border ${
                                      statusInfo.isLive
                                        ? 'bg-emerald-600 text-white border-emerald-700 animate-pulse'
                                        : 'bg-purple-100 text-purple-800 border-purple-200'
                                    }`}
                                  >
                                    P{slot.periodNumber}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                      <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                        {subCode}
                                      </span>
                                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                        {subName}
                                      </h4>
                                      <Badge variant={statusInfo.variant} size="xs">
                                        {statusInfo.status}
                                      </Badge>
                                    </div>

                                    {/* Class Time & Room specifications */}
                                    <div className="mt-2 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs text-slate-600 font-medium">
                                      <span className="font-mono text-slate-800 font-semibold flex items-center space-x-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span>{slot.startTime} &mdash; {slot.endTime}</span>
                                      </span>
                                      <span className="flex items-center space-x-1">
                                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Room {slot.roomNumber || 'LH-101'}</span>
                                      </span>
                                      <span className="flex items-center space-x-1">
                                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Section {slot.section || 'A'} &bull; Sem {slot.semester}</span>
                                      </span>
                                      <span className="text-slate-400 text-[11px]">
                                        {slot.department?.name || myDeptName}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Action for Today's Classes */}
                                {isToday && onOpenAttendance && (
                                  <Button
                                    variant="purple"
                                    size="xs"
                                    icon={CalendarCheck}
                                    onClick={() => {
                                      const subId = slot.subject?._id || slot.subject?.id || slot.subject;
                                      onOpenAttendance(subId, slot.periodNumber);
                                      onClose();
                                    }}
                                    className="flex-shrink-0"
                                  >
                                    Mark Attendance
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 text-xs text-slate-500">
            <span>
              Today: <strong>{todayName}</strong> ({todaySlotsCount} lectures scheduled today)
            </span>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyScheduleModal;
