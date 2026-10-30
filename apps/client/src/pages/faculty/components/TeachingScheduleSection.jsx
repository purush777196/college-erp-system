import React, { useState, useMemo } from 'react';
import {
  Clock,
  CalendarCheck,
  Calendar,
  MapPin,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const TeachingScheduleSection = ({
  timetableSlots = [],
  myDeptName = 'Engineering',
  onOpenAttendanceModal,
  onNavigateToSubject
}) => {
  const [selectedDay, setSelectedDay] = useState('all');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week

  const todayName = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  }, []);

  // Compute current period status (Completed, In Progress, Upcoming)
  const getPeriodStatus = (slot) => {
    const isToday = slot.dayOfWeek && slot.dayOfWeek.toLowerCase() === todayName.toLowerCase();
    if (!isToday || weekOffset !== 0) {
      return { status: 'scheduled', label: 'Scheduled', variant: 'slate' };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTimeToMinutes = (tStr) => {
      if (!tStr) return 0;
      const [h, m] = tStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const startMin = parseTimeToMinutes(slot.startTime);
    const endMin = parseTimeToMinutes(slot.endTime);

    if (currentMinutes < startMin) {
      return { status: 'upcoming', label: 'Upcoming Today', variant: 'purple' };
    }
    if (currentMinutes >= startMin && currentMinutes <= endMin) {
      return { status: 'in_progress', label: 'In Session Now', variant: 'emerald' };
    }
    return { status: 'completed', label: 'Completed', variant: 'teal' };
  };

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const map = {};
    DAYS_OF_WEEK.forEach((d) => {
      map[d] = [];
    });

    timetableSlots.forEach((slot) => {
      if (!slot?.dayOfWeek) return;
      const matchDay = DAYS_OF_WEEK.find(
        (d) => d.toLowerCase() === slot.dayOfWeek.toLowerCase()
      );
      if (matchDay) {
        map[matchDay].push(slot);
      }
    });

    // Sort periods numerically by periodNumber or startTime
    DAYS_OF_WEEK.forEach((d) => {
      map[d].sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));
    });

    return map;
  }, [timetableSlots]);

  // Filtered days based on day tab
  const displayDays = useMemo(() => {
    if (selectedDay !== 'all') {
      return [selectedDay];
    }
    return DAYS_OF_WEEK;
  }, [selectedDay]);

  const totalWeeklyClasses = timetableSlots.length;
  const todayClassesCount = (slotsByDay[todayName] || []).length;

  return (
    <div className="space-y-6">
      <Card
        title="Weekly Teaching Schedule & Timetable Slots"
        subtitle={`Scheduled academic lectures and lab sessions assigned to your faculty profile (AY 2025-26)`}
        headerAction={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white transition-colors cursor-pointer"
                title="Previous Academic Week"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-semibold text-slate-700">
                {weekOffset === 0 ? 'Current Week' : weekOffset < 0 ? `${Math.abs(weekOffset)} Week Ago` : `In ${weekOffset} Week`}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white transition-colors cursor-pointer"
                title="Next Academic Week"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {weekOffset !== 0 && (
              <Button variant="secondary" size="xs" onClick={() => setWeekOffset(0)}>
                This Week
              </Button>
            )}
          </div>
        }
      >
        {/* Weekly Metric Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-purple-50/70 border border-purple-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider block">
                Total Classes
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {totalWeeklyClasses}
              </span>
              <span className="text-[10px] text-purple-600 block">Weekly Periods</span>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                Today's Schedule
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {todayClassesCount}
              </span>
              <span className="text-[10px] text-emerald-600 block">{todayName}</span>
            </div>
          </div>

          <div className="bg-teal-50/70 border border-teal-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-700 tracking-wider block">
                Classrooms
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {new Set(timetableSlots.map((s) => s.roomNumber).filter(Boolean)).size || 1}
              </span>
              <span className="text-[10px] text-teal-600 block">Allotted Rooms & Labs</span>
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block">
                Working Days
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {DAYS_OF_WEEK.filter((d) => (slotsByDay[d] || []).length > 0).length} / 7
              </span>
              <span className="text-[10px] text-indigo-600 block">Active Lecture Days</span>
            </div>
          </div>
        </div>

        {/* Day of Week Navigation Filter */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-3 mb-6 border-b border-slate-100 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedDay('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              selectedDay === 'all'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>All Days</span>
            <span className="opacity-80">({totalWeeklyClasses})</span>
          </button>

          {DAYS_OF_WEEK.map((day) => {
            const count = (slotsByDay[day] || []).length;
            const isToday = day.toLowerCase() === todayName.toLowerCase();
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-xs'
                    : isToday
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{day.slice(0, 3)}</span>
                {isToday && <span className="text-[10px] uppercase font-bold text-purple-600 px-1 rounded bg-white/70">Today</span>}
                <span className="opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Timetable by Day */}
        {totalWeeklyClasses === 0 ? (
          <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No Teaching Timetable Sessions</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              There are no weekly timetable lecture periods allocated to your faculty profile.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayDays.map((day) => {
              const daySlots = slotsByDay[day] || [];
              const isToday = day.toLowerCase() === todayName.toLowerCase();

              return (
                <div
                  key={day}
                  className={`rounded-2xl border transition-all p-4 ${
                    isToday
                      ? 'border-purple-300 bg-purple-50/20 shadow-xs'
                      : 'border-slate-200/90 bg-white'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-slate-900">{day}</span>
                      {isToday && (
                        <Badge variant="purple" size="xs">
                          Today
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {daySlots.length} lecture period{daySlots.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Day Slots Grid */}
                  {daySlots.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs font-medium text-slate-500">No classes scheduled on {day}.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Use this day for grading, research, or student consultations.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {daySlots.map((slot) => {
                        const statusObj = getPeriodStatus(slot);
                        const subName = slot.subject?.name || slot.subject?.code || 'Lecture Class';
                        const subCode = slot.subject?.code || 'SUB';

                        return (
                          <div
                            key={slot._id || slot.id}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between text-xs ${
                              isToday
                                ? 'bg-white border-purple-200 hover:border-purple-300 shadow-xs'
                                : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                            }`}
                          >
                            <div>
                              {/* Top row: Time + Period + Status */}
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center space-x-1.5 font-mono font-bold text-slate-800">
                                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                                  <span>{slot.startTime} - {slot.endTime}</span>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  <Badge variant="navy" size="xs">
                                    Period {slot.periodNumber}
                                  </Badge>
                                  <Badge variant={statusObj.variant} size="xs">
                                    {statusObj.label}
                                  </Badge>
                                </div>
                              </div>

                              {/* Subject title & code */}
                              <h4 className="font-bold text-slate-900 text-sm tracking-tight">
                                {subName}
                              </h4>
                              <p className="text-[11px] text-purple-700 font-mono font-medium mt-0.5">
                                {subCode} &bull; Semester {slot.semester} &bull; Section {slot.section || 'A'}
                              </p>
                            </div>

                            {/* Bottom row: Classroom + Action button */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                              <span className="text-[11px] font-semibold text-slate-600 inline-flex items-center space-x-1">
                                <MapPin className="w-3 h-3 text-purple-600" />
                                <span>Room {slot.roomNumber || 'LH-101'}</span>
                              </span>

                              {isToday && onOpenAttendanceModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAttendanceModal(slot.subject?._id || slot.subject?.id || slot.subject, slot.periodNumber)}
                                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1"
                                >
                                  <CalendarCheck className="w-3 h-3" />
                                  <span>Mark Attendance</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default TeachingScheduleSection;
