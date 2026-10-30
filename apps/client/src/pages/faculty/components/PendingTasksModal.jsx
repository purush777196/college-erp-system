import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  Award,
  FileText,
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';

export const PendingTasksModal = ({
  isOpen,
  onClose,
  tasks = [],
  onRefresh,
  isLoading = false
}) => {
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all' | 'attendance' | 'examination' | 'assignment'

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

  // Reset category on open
  useEffect(() => {
    if (isOpen) {
      setSelectedCategory('all');
    }
  }, [isOpen]);

  // Category counts
  const attendanceTasks = useMemo(() => tasks.filter((t) => t.category === 'attendance'), [tasks]);
  const examTasks = useMemo(() => tasks.filter((t) => t.category === 'examination'), [tasks]);
  const assignmentTasks = useMemo(() => tasks.filter((t) => t.category === 'assignment'), [tasks]);

  const filteredTasks = useMemo(() => {
    if (selectedCategory === 'all') return tasks;
    return tasks.filter((t) => t.category === selectedCategory);
  }, [tasks, selectedCategory]);

  const getCategoryMeta = (cat) => {
    switch (cat) {
      case 'attendance':
        return {
          label: 'Attendance',
          icon: CalendarCheck,
          badgeVariant: 'purple',
          bgColor: 'bg-purple-100 text-purple-700 border-purple-200'
        };
      case 'examination':
        return {
          label: 'Examination Marks',
          icon: Award,
          badgeVariant: 'amber',
          bgColor: 'bg-amber-100 text-amber-800 border-amber-200'
        };
      case 'assignment':
        return {
          label: 'Assignment Evaluation',
          icon: FileText,
          badgeVariant: 'teal',
          bgColor: 'bg-teal-100 text-teal-800 border-teal-200'
        };
      default:
        return {
          label: 'Academic Task',
          icon: AlertTriangle,
          badgeVariant: 'slate',
          bgColor: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-pending-tasks-title">
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
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 id="modal-pending-tasks-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Pending Academic Tasks
                  </h2>
                  <Badge variant={tasks.length === 0 ? 'emerald' : 'amber'} size="xs" className="bg-white/20 text-white border-white/20">
                    {tasks.length === 0 ? 'All Completed' : `${tasks.length} Awaiting Action`}
                  </Badge>
                </div>
                <p className="text-xs text-purple-200 mt-0.5">
                  Actionable sessions requiring attendance capture, active exams awaiting marks entry, and assignment evaluations
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title="Refresh tasks"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              All Tasks ({tasks.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('attendance')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                selectedCategory === 'attendance'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <span>Attendance</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-purple-100 text-purple-800">
                {attendanceTasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('examination')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                selectedCategory === 'examination'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <span>Examinations</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-100 text-amber-800">
                {examTasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('assignment')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                selectedCategory === 'assignment'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <span>Assignments</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-teal-100 text-teal-800">
                {assignmentTasks.length}
              </span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  You're all caught up! No pending academic tasks.
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                  All scheduled lecture attendance has been recorded, active examination marks have been submitted, and assignment evaluations are up to date.
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const meta = getCategoryMeta(task.category);
                const Icon = meta.icon;

                return (
                  <div
                    key={task.id}
                    className="p-4 sm:p-4.5 rounded-2xl border border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm transition-all flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                      {/* Category Icon Avatar */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border mt-0.5 ${meta.bgColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {task.title}
                          </h4>
                          <Badge variant={task.priority === 'High' ? 'rose' : task.priority === 'Medium' ? 'amber' : 'purple'} size="xs">
                            {task.priority || 'Normal'} Priority
                          </Badge>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {task.status}
                          </span>
                        </div>

                        {/* Subject, Section & Date Details */}
                        <div className="mt-2 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {task.subject}
                          </span>
                          {task.section && (
                            <span>&bull; Section {task.section}</span>
                          )}
                          {task.roomNumber && (
                            <span>&bull; Room {task.roomNumber}</span>
                          )}
                          {task.date && (
                            <span className="flex items-center space-x-1 text-slate-500">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{task.date} {task.time ? `(${task.time})` : ''}</span>
                            </span>
                          )}
                          {task.pendingStudentsCount !== undefined && (
                            <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {task.pendingStudentsCount} Students Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Direct Action Button */}
                    <div className="flex-shrink-0 self-center">
                      <Button
                        variant={task.category === 'attendance' ? 'purple' : task.category === 'examination' ? 'teal' : 'secondary'}
                        size="sm"
                        onClick={() => {
                          onClose();
                          task.onAction?.();
                        }}
                        className="whitespace-nowrap shadow-xs"
                      >
                        <span>{task.actionLabel || 'Take Action'}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 text-xs text-slate-500">
            <span>
              Action buttons open corresponding workflows directly within your faculty workspace.
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

export default PendingTasksModal;
