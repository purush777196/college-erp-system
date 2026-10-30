import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  Award,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  RefreshCw
} from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';

export const PendingTasksSection = ({
  tasks = [],
  onRefresh,
  isLoading = false
}) => {
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'attendance' | 'examination' | 'assignment'

  const filteredTasks = useMemo(() => {
    if (categoryFilter === 'all') return tasks;
    return tasks.filter((t) => t.category === categoryFilter);
  }, [tasks, categoryFilter]);

  const attendanceCount = useMemo(() => {
    return tasks.filter((t) => t.category === 'attendance').length;
  }, [tasks]);

  const examCount = useMemo(() => {
    return tasks.filter((t) => t.category === 'examination').length;
  }, [tasks]);

  const assignmentCount = useMemo(() => {
    return tasks.filter((t) => t.category === 'assignment').length;
  }, [tasks]);

  return (
    <div className="space-y-6">
      <Card
        title="Pending Academic Tasks & Action Center"
        subtitle="Unmarked classroom sessions, pending examination evaluations, and assignment reviews"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              onClick={onRefresh}
              icon={RefreshCw}
              isLoading={isLoading}
              title="Refresh Pending Tasks"
            >
              Refresh
            </Button>
          </div>
        }
      >
        {/* Metric Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-purple-50/70 border border-purple-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider block">
                Total Pending
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {tasks.length}
              </span>
              <span className="text-[10px] text-purple-600 block">Actionable Tasks</span>
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider block">
                Attendance
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {attendanceCount}
              </span>
              <span className="text-[10px] text-rose-600 block">Unmarked Sessions</span>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-700 tracking-wider block">
                Exam Marks
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {examCount}
              </span>
              <span className="text-[10px] text-amber-600 block">Awaiting Entry</span>
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-xl p-3 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider block">
                Assignments
              </span>
              <span className="text-lg font-bold text-slate-900 leading-tight">
                {assignmentCount}
              </span>
              <span className="text-[10px] text-indigo-600 block">Need Grading</span>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-3 mb-5 border-b border-slate-100 scrollbar-none">
          {[
            { id: 'all', label: 'All Tasks', count: tasks.length },
            { id: 'attendance', label: 'Attendance', count: attendanceCount },
            { id: 'examination', label: 'Examinations', count: examCount },
            { id: 'assignment', label: 'Assignments', count: assignmentCount }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                categoryFilter === cat.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{cat.label}</span>
              <span className="opacity-80">({cat.count})</span>
            </button>
          ))}
        </div>

        {/* Empty State when 0 Tasks */}
        {tasks.length === 0 ? (
          <div className="py-12 px-4 text-center border-2 border-dashed border-emerald-200 rounded-2xl bg-emerald-50/40">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">You're all caught up! No pending academic tasks.</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              All scheduled lecture attendance has been logged, examination marks submitted, and student assignments evaluated.
            </p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-600">No pending tasks under this category.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((t) => {
              const categoryColor =
                t.category === 'attendance'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : t.category === 'examination'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200';

              const priorityVariant =
                t.priority === 'High' ? 'danger' : t.priority === 'Medium' ? 'amber' : 'purple';

              return (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:shadow-card transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${categoryColor}`}>
                        {t.category}
                      </span>
                      <Badge variant={priorityVariant} size="xs">
                        {t.priority} Priority
                      </Badge>
                      <span className="text-[11px] font-medium text-slate-500">
                        {t.date} {t.time && `(${t.time})`}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                      {t.title}
                    </h4>

                    <p className="text-xs text-slate-600 flex items-center space-x-2 flex-wrap">
                      <span className="font-semibold text-purple-700">{t.subject}</span>
                      {t.section && (
                        <>
                          <span>&bull;</span>
                          <span>Section {t.section}</span>
                        </>
                      )}
                      {t.roomNumber && (
                        <>
                          <span>&bull;</span>
                          <span>Room {t.roomNumber}</span>
                        </>
                      )}
                      {t.pendingStudentsCount !== undefined && (
                        <>
                          <span>&bull;</span>
                          <span className="text-amber-700 font-medium">{t.pendingStudentsCount} students pending entry</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={t.onAction}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>{t.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PendingTasksSection;
